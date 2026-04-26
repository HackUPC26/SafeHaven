import AVFoundation
import ExpoModulesCore
import SoundAnalysis

private let audioLabelEvent = "onAudioLabel"
private let audioClassificationDebugEvent = "onAudioClassificationDebug"
private let confidenceThreshold = 0.60
private let duplicateSuppressionSeconds = 2.0
private let extendedSilenceSeconds = 5.0

public final class SafeHavenAIModule: Module {
  private let analysisQueue = DispatchQueue(label: "safehaven.ai.sound-analysis")
  private var audioEngine: AVAudioEngine?
  private var analyzer: SNAudioStreamAnalyzer?
  private var classifyRequest: SNClassifySoundRequest?
  private var observer: SafeHavenSoundObserver?
  private var isRunning = false
  private var silenceStartedAt: Date?
  private var lastEmittedAtByLabel: [String: Date] = [:]

  public func definition() -> ModuleDefinition {
    Name("SafeHavenAI")

    Events(audioLabelEvent, audioClassificationDebugEvent)

    AsyncFunction("isSoundClassificationAvailable") { () -> Bool in
      return Self.soundClassificationAvailable
    }

    AsyncFunction("startSoundClassification") { (promise: Promise) in
      self.startSoundClassification(promise: promise)
    }

    AsyncFunction("stopSoundClassification") { () -> Bool in
      self.stopSoundClassification()
      return true
    }

    OnDestroy {
      self.stopSoundClassification()
    }
  }

  private static var soundClassificationAvailable: Bool {
    #if targetEnvironment(simulator)
    return false
    #else
    if #available(iOS 15.0, *) {
      return true
    }
    return false
    #endif
  }

  private func startSoundClassification(promise: Promise) {
    if isRunning {
      promise.resolve(true)
      return
    }

    guard Self.soundClassificationAvailable else {
      print("[SafeHavenAI] SoundAnalysis is unavailable on this device")
      promise.resolve(false)
      return
    }

    AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
      guard let self else {
        promise.resolve(false)
        return
      }

      self.analysisQueue.async {
        guard granted else {
          print("[SafeHavenAI] Microphone permission denied")
          promise.resolve(false)
          return
        }

        do {
          try self.startEngine()
          promise.resolve(true)
        } catch {
          print("[SafeHavenAI] Failed to start sound classification: \(error.localizedDescription)")
          self.stopSoundClassificationOnQueue()
          promise.resolve(false)
        }
      }
    }
  }

  private func startEngine() throws {
    if isRunning {
      return
    }

    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .measurement, options: [.mixWithOthers, .allowBluetoothHFP])
    try session.setActive(true)

    let engine = AVAudioEngine()
    let inputNode = engine.inputNode
    let inputFormat = inputNode.outputFormat(forBus: 0)

    guard inputFormat.channelCount > 0, inputFormat.sampleRate > 0 else {
      throw SafeHavenAIError.invalidAudioInput
    }

    let analyzer = SNAudioStreamAnalyzer(format: inputFormat)
    let request = try SNClassifySoundRequest(classifierIdentifier: .version1)
    let observer = SafeHavenSoundObserver(owner: self)
    request.overlapFactor = 0.5

    try analyzer.add(request, withObserver: observer)

    self.audioEngine = engine
    self.analyzer = analyzer
    self.classifyRequest = request
    self.observer = observer
    self.silenceStartedAt = nil
    self.lastEmittedAtByLabel = [:]

    inputNode.installTap(onBus: 0, bufferSize: 8192, format: inputFormat) { [weak self] buffer, time in
      guard let self else {
        return
      }
      self.analysisQueue.async {
        self.analyzer?.analyze(buffer, atAudioFramePosition: time.sampleTime)
      }
    }

    engine.prepare()
    try engine.start()

    self.isRunning = true
  }

  @discardableResult
  private func stopSoundClassification() -> Bool {
    analysisQueue.async { [weak self] in
      self?.stopSoundClassificationOnQueue()
    }

    return true
  }

  private func stopSoundClassificationOnQueue() {
    audioEngine?.inputNode.removeTap(onBus: 0)
    audioEngine?.stop()
    analyzer?.removeAllRequests()
    analyzer = nil
    classifyRequest = nil
    observer = nil
    audioEngine = nil
    silenceStartedAt = nil
    lastEmittedAtByLabel = [:]
    isRunning = false
  }

  fileprivate func handleClassifications(_ classifications: [SNClassification]) {
    guard let topClassification = classifications.first else {
      return
    }

    emitClassificationDebug(classifications)

    let topIdentifier = normalizeIdentifier(topClassification.identifier)
    if topIdentifier == "silence" {
      handleSilence(rawIdentifier: topClassification.identifier, confidence: topClassification.confidence)
      return
    }

    silenceStartedAt = nil

    for classification in classifications {
      let normalizedIdentifier = normalizeIdentifier(classification.identifier)
      guard classification.confidence >= confidenceThreshold,
            let label = safeHavenLabel(for: normalizedIdentifier) else {
        continue
      }

      emitLabel(label, confidence: classification.confidence, rawIdentifier: classification.identifier)
      return
    }
  }

  fileprivate func handleSoundAnalysisFailure(_ error: Error) {
    print("[SafeHavenAI] SoundAnalysis request failed: \(error.localizedDescription)")
    stopSoundClassification()
  }

  fileprivate func handleSoundAnalysisCompletion() {
    stopSoundClassification()
  }

  private func handleSilence(rawIdentifier: String, confidence: Double) {
    guard confidence >= confidenceThreshold else {
      silenceStartedAt = nil
      return
    }

    let now = Date()
    if silenceStartedAt == nil {
      silenceStartedAt = now
      return
    }

    guard let startedAt = silenceStartedAt,
          now.timeIntervalSince(startedAt) >= extendedSilenceSeconds else {
      return
    }

    emitLabel("EXTENDED_SILENCE", confidence: confidence, rawIdentifier: rawIdentifier)
  }

  private func emitLabel(_ label: String, confidence: Double, rawIdentifier: String) {
    let now = Date()
    if let lastEmittedAt = lastEmittedAtByLabel[label],
       now.timeIntervalSince(lastEmittedAt) < duplicateSuppressionSeconds {
      return
    }

    lastEmittedAtByLabel[label] = now

    DispatchQueue.main.async { [weak self] in
      self?.sendEvent(audioLabelEvent, [
        "label": label,
        "confidence": confidence,
        "ts": Int(now.timeIntervalSince1970 * 1000),
        "source": "SoundAnalysis",
        "rawIdentifier": rawIdentifier
      ])
    }
  }

  private func emitClassificationDebug(_ classifications: [SNClassification]) {
    #if DEBUG
    let topClassifications: [[String: Any]] = classifications.prefix(5).map { classification in
      let normalizedIdentifier = normalizeIdentifier(classification.identifier)
      return [
        "identifier": classification.identifier,
        "normalizedIdentifier": normalizedIdentifier,
        "confidence": classification.confidence,
        "mappedLabel": safeHavenLabel(for: normalizedIdentifier) ?? NSNull()
      ]
    }

    guard let topClassification = topClassifications.first else {
      return
    }

    DispatchQueue.main.async { [weak self] in
      self?.sendEvent(audioClassificationDebugEvent, [
        "topIdentifier": topClassification["identifier"] ?? "",
        "topConfidence": topClassification["confidence"] ?? 0,
        "threshold": confidenceThreshold,
        "classifications": Array(topClassifications),
        "ts": Int(Date().timeIntervalSince1970 * 1000)
      ])
    }
    #endif
  }

  private func normalizeIdentifier(_ identifier: String) -> String {
    return identifier
      .lowercased()
      .replacingOccurrences(of: " ", with: "_")
      .replacingOccurrences(of: "-", with: "_")
  }

  private func safeHavenLabel(for identifier: String) -> String? {
    if identifier == "shout" ||
      identifier == "yell" ||
      identifier == "children_shouting" ||
      identifier.contains("shout") ||
      identifier.contains("yell") {
      return "SHOUTING"
    }

    if identifier == "screaming" ||
      identifier == "battle_cry" ||
      identifier.contains("scream") {
      return "SCREAMING"
    }

    if identifier == "crying_sobbing" ||
      identifier == "baby_crying" ||
      identifier.contains("crying") ||
      identifier.contains("sobbing") {
      return "CRYING"
    }

    if identifier == "thump_thud" ||
      identifier == "crushing" ||
      identifier == "boom" ||
      identifier == "hammer" ||
      identifier == "knock" ||
      identifier == "tap" ||
      identifier == "wood_cracking" ||
      identifier == "chopping_wood" {
      return "IMPACT"
    }

    if identifier == "gunshot_gunfire" {
      return "GUNSHOT"
    }

    if identifier == "slap_smack" {
      return "SLAP"
    }

    if identifier == "door_slam" {
      return "DOOR_SLAM"
    }

    if identifier == "glass_breaking" ||
      identifier == "glass_clink" {
      return "GLASS_BREAKING"
    }

    return nil
  }
}

private final class SafeHavenSoundObserver: NSObject, SNResultsObserving {
  private weak var owner: SafeHavenAIModule?

  init(owner: SafeHavenAIModule) {
    self.owner = owner
  }

  func request(_ request: SNRequest, didProduce result: SNResult) {
    guard let result = result as? SNClassificationResult,
          !result.classifications.isEmpty else {
      return
    }

    owner?.handleClassifications(result.classifications)
  }

  func request(_ request: SNRequest, didFailWithError error: Error) {
    owner?.handleSoundAnalysisFailure(error)
  }

  func requestDidComplete(_ request: SNRequest) {
    owner?.handleSoundAnalysisCompletion()
  }
}

private enum SafeHavenAIError: LocalizedError {
  case invalidAudioInput

  var errorDescription: String? {
    switch self {
    case .invalidAudioInput:
      return "Microphone input format is invalid"
    }
  }
}
