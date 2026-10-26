import Capacitor
import UIKit

/// Reports the size of the app window, and the system regions that cover it, to the web layer.
///
/// The web layer cannot take the window shape from its own viewport: the WebView viewport
/// shrinks while the soft keyboard is up. Nor from the device: on iPhone Duo the inner display
/// ignores the supported interface orientations, so UIDevice orientation (which
/// @capacitor/screen-orientation reads) says portrait while the window is landscape.
/// BridgeViewController forwards its size changes here; the root view always fills the window.
///
/// Occlusion regions (iOS 27.1) are system UI drawn over the window, such as the camera and
/// status bar island on iPhone Duo's outer display. Their frames are sent in the WebView's
/// coordinate space, which is the CSS pixel space of the page.
@objc(WindowGeometryPlugin)
class WindowGeometryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WindowGeometryPlugin"
    public let jsName = "WindowGeometry"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getWindowGeometry", returnType: CAPPluginReturnPromise),
    ]

    private var lastPublished: NSDictionary?

    @objc func getWindowGeometry(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(self.geometry(windowSize: nil, includeOcclusions: true))
        }
    }

    /// The window is about to change size: rotation, Split View, or opening and closing
    /// iPhone Duo. The regions for the new size are not known yet, so only the size is sent
    /// now and the layout pass that follows sends the regions.
    func windowWillResize(to size: CGSize) {
        publish(geometry(windowSize: size, includeOcclusions: false))
    }

    func windowDidLayout() {
        publish(geometry(windowSize: nil, includeOcclusions: true))
    }

    private func publish(_ geometry: [String: Any]) {
        let published = geometry as NSDictionary
        if lastPublished?.isEqual(published) == true {
            return
        }

        lastPublished = published
        notifyListeners("windowGeometryChange", data: geometry)
    }

    private func geometry(windowSize: CGSize?, includeOcclusions: Bool) -> [String: Any] {
        guard let view = bridge?.viewController?.view else {
            return ["width": 0, "height": 0]
        }

        let size = windowSize ?? view.bounds.size
        var geometry: [String: Any] = [
            "width": Double(size.width),
            "height": Double(size.height),
        ]
        if includeOcclusions {
            geometry["occlusions"] = occlusionRegions(in: view)
        }
        return geometry
    }

    private func occlusionRegions(in view: UIView) -> [[String: Any]] {
        guard #available(iOS 27.1, *), let webView = bridge?.webView else {
            return []
        }

        let bounds = webView.bounds
        let safeArea = webView.safeAreaInsets
        return view.reservedRegions(kind: .occlusion).filter(\.isActive).map { region in
            let frame = view.convert(region.frame, to: webView)
            var payload: [String: Any] = [
                "x": Double(frame.minX),
                "y": Double(frame.minY),
                "width": Double(frame.width),
                "height": Double(frame.height),
                "margins": [
                    "top": Double(region.margins.top),
                    "left": Double(region.margins.left),
                    "bottom": Double(region.margins.bottom),
                    "right": Double(region.margins.right),
                ],
            ]
            if let edge = safeAreaEdge(containing: frame, bounds: bounds, safeArea: safeArea) {
                payload["edge"] = edge
            }
            return payload
        }
    }

    /// The safe-area edge whose inset this region accounts for, when the region lies inside
    /// that edge's inset strip. On iPhone Duo's outer display the island sits inside the right
    /// strip, so the whole right inset exists because of it.
    private func safeAreaEdge(containing frame: CGRect, bounds: CGRect, safeArea: UIEdgeInsets) -> String? {
        let tolerance: CGFloat = 0.5
        if safeArea.right > 0, frame.minX >= bounds.maxX - safeArea.right - tolerance {
            return "right"
        }
        if safeArea.left > 0, frame.maxX <= bounds.minX + safeArea.left + tolerance {
            return "left"
        }
        if safeArea.top > 0, frame.maxY <= bounds.minY + safeArea.top + tolerance {
            return "top"
        }
        if safeArea.bottom > 0, frame.minY >= bounds.maxY - safeArea.bottom - tolerance {
            return "bottom"
        }
        return nil
    }
}
