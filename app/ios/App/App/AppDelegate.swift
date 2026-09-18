import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    // A web view opens its store when it is built and keeps it open for the life of the process,
    // so a store the app has found unusable can only be thrown away from here, before the first
    // web view exists. The page asks for it by leaving this file behind when it catches the store
    // dropping writes; everything that was in the store is kept in the file beside it and put back
    // once the new one is up, which is what makes clearing it safe.
    // The folder is the one the file system plugin writes its "library, not backed up" files to.
    private static let resetMarkerPath = "NoCloud/state/reset-web-storage"

    func application(_ application: UIApplication, willFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        clearLocalStorageIfAsked()
        return true
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    private func clearLocalStorageIfAsked() {
        let fileManager = FileManager.default
        guard let library = fileManager.urls(for: .libraryDirectory, in: .userDomainMask).first else {
            return
        }
        let marker = library.appendingPathComponent(AppDelegate.resetMarkerPath)
        guard fileManager.fileExists(atPath: marker.path) else {
            return
        }

        let webKit = library.appendingPathComponent("WebKit")
        var roots = [webKit.appendingPathComponent("WebsiteData")]
        if let bundleIdentifier = Bundle.main.bundleIdentifier {
            roots.append(webKit.appendingPathComponent(bundleIdentifier).appendingPathComponent("WebsiteData"))
        }
        for root in roots {
            removeLocalStorageFolders(under: root, using: fileManager)
        }

        try? fileManager.removeItem(at: marker)
    }

    // The store sits a few hashed folders deep and shares the innermost one with IndexedDB, which
    // has no part in this and can take minutes to build again. So only the folders that hold the
    // store are taken, wherever this version of the system decided to put them.
    private func removeLocalStorageFolders(under root: URL, using fileManager: FileManager) {
        guard let walker = fileManager.enumerator(
            at: root,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return
        }

        var folders: [URL] = []
        for case let url as URL in walker where url.lastPathComponent == "LocalStorage" {
            if (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true {
                folders.append(url)
                walker.skipDescendants()
            }
        }

        for folder in folders {
            // A store that stopped taking writes may have lost the right to be written to at all,
            // and what is inside a folder only goes if the folder itself can be written.
            makeWritable(folder, using: fileManager)
            try? fileManager.removeItem(at: folder)
        }
    }

    private func makeWritable(_ url: URL, using fileManager: FileManager) {
        try? fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: url.path)
        guard let walker = fileManager.enumerator(at: url, includingPropertiesForKeys: nil) else {
            return
        }
        for case let child as URL in walker {
            try? fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: child.path)
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
