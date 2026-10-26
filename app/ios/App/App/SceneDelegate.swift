import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = BridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// Forwards window size changes and layout passes to WindowGeometryPlugin, which the web layer
// reads for the window shape and the system regions drawn over it.
class BridgeViewController: CAPBridgeViewController {
    private let windowGeometryPlugin = WindowGeometryPlugin()

    override open func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        windowGeometryPlugin.windowWillResize(to: size)
    }

    override open func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        windowGeometryPlugin.windowDidLayout()
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(windowGeometryPlugin)
    }
}
