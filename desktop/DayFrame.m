#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

@interface DayFrameDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply>
@property NSWindow *window;
@property WKWebView *webView;
@property NSTask *service;
@property NSPipe *serviceInput;
@property NSPipe *serviceOutput;
@property NSMutableData *startup;
@property NSURL *origin;
@property BOOL ready;
@property BOOL quitting;
@property BOOL savePending;
@end

@implementation DayFrameDelegate
- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    NSString *identifier = NSBundle.mainBundle.bundleIdentifier;
    for (NSRunningApplication *other in [NSRunningApplication runningApplicationsWithBundleIdentifier:identifier]) {
        if (other.processIdentifier != NSProcessInfo.processInfo.processIdentifier) {
            [other activateWithOptions:NSApplicationActivateAllWindows];
            [NSApp terminate:nil]; return;
        }
    }
    [self makeMenu];
    self.window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, 1280, 840)
        styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable
        backing:NSBackingStoreBuffered defer:NO];
    self.window.title = @"DayFrame";
    self.window.minSize = NSMakeSize(840, 600);
    self.window.releasedWhenClosed = NO;
    [self.window center];
    [self.window setFrameAutosaveName:@"DayFrameMainWindow"];
    WKWebViewConfiguration *configuration = [WKWebViewConfiguration new];
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = NO;
    [configuration.userContentController addScriptMessageHandlerWithReply:self contentWorld:WKContentWorld.pageWorld name:@"saveBackup"];
    NSString *bridge = @"Object.defineProperty(window, 'dayframeDesktop', { value: Object.freeze({saveBackup: (name, content) => window.webkit.messageHandlers.saveBackup.postMessage({name, content})}), writable: false });";
    [configuration.userContentController addUserScript:[[WKUserScript alloc] initWithSource:bridge injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES]];
    self.webView = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:configuration];
    self.webView.navigationDelegate = self;
    self.webView.UIDelegate = self;
    self.webView.allowsBackForwardNavigationGestures = NO;
    self.window.contentView = self.webView;
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
    [self startService];
}
- (void)makeMenu {
    NSMenu *menu = [NSMenu new];
    NSMenuItem *app = [NSMenuItem new]; [menu addItem:app];
    NSMenu *appMenu = [NSMenu new]; app.submenu = appMenu;
    [appMenu addItemWithTitle:@"关于 DayFrame" action:@selector(orderFrontStandardAboutPanel:) keyEquivalent:@""];
    [appMenu addItem:NSMenuItem.separatorItem];
    [appMenu addItemWithTitle:@"隐藏 DayFrame" action:@selector(hide:) keyEquivalent:@"h"];
    [appMenu addItem:NSMenuItem.separatorItem];
    [appMenu addItemWithTitle:@"退出 DayFrame" action:@selector(terminate:) keyEquivalent:@"q"];
    NSMenuItem *edit = [NSMenuItem new]; [menu addItem:edit];
    NSMenu *editMenu = [[NSMenu alloc] initWithTitle:@"编辑"]; edit.submenu = editMenu;
    NSArray *actions = @[@[@"撤销", @"undo:", @"z"], @[@"重做", @"redo:", @"Z"], @[@"剪切", @"cut:", @"x"], @[@"复制", @"copy:", @"c"], @[@"粘贴", @"paste:", @"v"], @[@"全选", @"selectAll:", @"a"]];
    for (NSArray *item in actions) [editMenu addItemWithTitle:item[0] action:NSSelectorFromString(item[1]) keyEquivalent:item[2]];
    NSMenuItem *view = [NSMenuItem new]; [menu addItem:view];
    NSMenu *viewMenu = [[NSMenu alloc] initWithTitle:@"窗口"]; view.submenu = viewMenu;
    NSMenuItem *reload = [viewMenu addItemWithTitle:@"重新加载" action:@selector(reloadPage:) keyEquivalent:@"r"]; reload.target = self;
    [viewMenu addItemWithTitle:@"最小化" action:@selector(performMiniaturize:) keyEquivalent:@"m"];
    [viewMenu addItemWithTitle:@"缩放" action:@selector(performZoom:) keyEquivalent:@""];
    NSApp.mainMenu = menu; NSApp.windowsMenu = viewMenu;
}
- (void)reloadPage:(id)sender { if (self.ready) [self.webView reload]; }
- (void)startService {
    NSURL *resources = NSBundle.mainBundle.resourceURL;
    NSURL *support = [[NSFileManager.defaultManager URLsForDirectory:NSApplicationSupportDirectory inDomains:NSUserDomainMask].firstObject URLByAppendingPathComponent:@"DayFrame"];
    NSString *dataPath = NSProcessInfo.processInfo.environment[@"DAYFRAME_DATA_DIR"] ?: support.path;
    NSError *error;
    if (![NSFileManager.defaultManager createDirectoryAtPath:dataPath withIntermediateDirectories:YES attributes:@{NSFilePosixPermissions:@0700} error:&error]) {
        [self showError:error.localizedDescription fatal:YES]; return;
    }
    NSString *logPath = [dataPath stringByAppendingPathComponent:@"desktop.log"];
    [NSFileManager.defaultManager createFileAtPath:logPath contents:nil attributes:@{NSFilePosixPermissions:@0600}];
    self.service = [NSTask new];
    self.service.executableURL = [resources URLByAppendingPathComponent:@"node"];
    self.service.arguments = @[[resources URLByAppendingPathComponent:@"server.mjs"].path];
    self.service.environment = @{@"PATH":@"/usr/bin:/bin", @"HOME":NSHomeDirectory(), @"DAYFRAME_DATA_DIR":dataPath, @"DAYFRAME_RESOURCES":resources.path};
    self.serviceInput = [NSPipe pipe]; self.serviceOutput = [NSPipe pipe]; self.startup = [NSMutableData data];
    self.service.standardInput = self.serviceInput;
    self.service.standardOutput = self.serviceOutput;
    self.service.standardError = [NSFileHandle fileHandleForWritingAtPath:logPath];
    __weak DayFrameDelegate *weakSelf = self;
    self.serviceOutput.fileHandleForReading.readabilityHandler = ^(NSFileHandle *handle) {
        NSData *chunk = handle.availableData;
        if (!chunk.length) { handle.readabilityHandler = nil; return; }
        dispatch_async(dispatch_get_main_queue(), ^{ [weakSelf receiveStartup:chunk]; });
    };
    self.service.terminationHandler = ^(NSTask *task) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!weakSelf.quitting) [weakSelf showError:@"本地服务已停止。请重新打开 DayFrame；如果问题持续，请检查应用数据目录中的 desktop.log。" fatal:YES];
        });
    };
    if (![self.service launchAndReturnError:&error]) { [self showError:error.localizedDescription fatal:YES]; return; }
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 25 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
        if (!weakSelf.ready && !weakSelf.quitting) [weakSelf showError:@"启动超时，请退出后重试。" fatal:YES];
    });
}
- (void)receiveStartup:(NSData *)chunk {
    if (self.ready) return;
    [self.startup appendData:chunk];
    NSString *text = [[NSString alloc] initWithData:self.startup encoding:NSUTF8StringEncoding];
    NSString *line = [text componentsSeparatedByString:@"\n"].firstObject;
    if (!line.length) return;
    NSDictionary *message = [NSJSONSerialization JSONObjectWithData:[line dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if (![message isKindOfClass:NSDictionary.class] || ![message[@"url"] isKindOfClass:NSString.class]) return;
    NSURL *url = [NSURL URLWithString:message[@"url"]];
    if (![url.host isEqualToString:@"127.0.0.1"] || !url.port) return;
    self.origin = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%@", url.port]];
    self.ready = YES;
    [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
}
- (BOOL)isLocal:(NSURL *)url {
    return [url.scheme isEqual:self.origin.scheme] && [url.host isEqual:self.origin.host] && [url.port isEqual:self.origin.port];
}
- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))handler {
    NSURL *url = action.request.URL;
    if ([self isLocal:url]) { handler(WKNavigationActionPolicyAllow); return; }
    handler(WKNavigationActionPolicyCancel);
    if (action.navigationType == WKNavigationTypeLinkActivated && [@[@"https", @"http", @"mailto"] containsObject:url.scheme]) [NSWorkspace.sharedWorkspace openURL:url];
}
- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    if (error.code != NSURLErrorCancelled) [self showError:error.localizedDescription fatal:NO];
}
- (void)webViewWebContentProcessDidTerminate:(WKWebView *)webView { [webView reload]; }
- (void)webView:(WKWebView *)webView runOpenPanelWithParameters:(WKOpenPanelParameters *)parameters initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(NSArray<NSURL *> *))handler {
    if (!frame.mainFrame || ![self isLocal:frame.request.URL]) { handler(nil); return; }
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.allowedContentTypes = @[UTTypeJSON]; panel.canChooseDirectories = NO; panel.allowsMultipleSelection = NO;
    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse response) { handler(response == NSModalResponseOK ? panel.URLs : nil); }];
}
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message replyHandler:(void (^)(id, NSString *))reply {
    if (!message.frameInfo.mainFrame || ![self isLocal:message.frameInfo.request.URL] || ![message.body isKindOfClass:NSDictionary.class]) { reply(nil, @"备份请求无效"); return; }
    NSDictionary *body = message.body;
    NSString *name = body[@"name"], *content = body[@"content"];
    if (![name isKindOfClass:NSString.class] || ![content isKindOfClass:NSString.class] || [content lengthOfBytesUsingEncoding:NSUTF8StringEncoding] > 64 * 1024 * 1024) { reply(nil, @"备份请求无效"); return; }
    if (self.savePending) { reply(nil, @"请先完成当前保存"); return; }
    self.savePending = YES;
    NSSavePanel *panel = [NSSavePanel savePanel]; panel.allowedContentTypes = @[UTTypeJSON];
    panel.nameFieldStringValue = name.lastPathComponent; panel.canCreateDirectories = YES;
    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse response) {
        self.savePending = NO;
        if (response != NSModalResponseOK || !panel.URL) { reply(@"cancelled", nil); return; }
        NSError *error;
        if ([content writeToURL:panel.URL atomically:YES encoding:NSUTF8StringEncoding error:&error]) reply(@"saved", nil);
        else reply(nil, [@"备份未保存成功：" stringByAppendingString:error.localizedDescription]);
    }];
}
- (void)showError:(NSString *)message fatal:(BOOL)fatal {
    if (self.quitting) return;
    if (fatal) self.quitting = YES;
    NSAlert *alert = [NSAlert new]; alert.messageText = @"DayFrame"; alert.informativeText = message;
    alert.alertStyle = NSAlertStyleWarning; [alert addButtonWithTitle:fatal ? @"退出" : @"好"];
    [alert runModal]; if (fatal) [NSApp terminate:nil];
}
- (BOOL)applicationShouldHandleReopen:(NSApplication *)sender hasVisibleWindows:(BOOL)visible {
    if (!visible) [self.window makeKeyAndOrderFront:nil]; return YES;
}
- (void)applicationWillTerminate:(NSNotification *)notification {
    self.quitting = YES;
    self.serviceOutput.fileHandleForReading.readabilityHandler = nil;
    [self.serviceInput.fileHandleForWriting closeFile];
    if (self.service.running) [self.service terminate];
}
@end
int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *app = NSApplication.sharedApplication;
        DayFrameDelegate *delegate = [DayFrameDelegate new];
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];
        app.delegate = delegate; [app run];
    }
    return 0;
}
