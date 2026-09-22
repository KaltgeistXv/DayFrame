#import <Cocoa/Cocoa.h>
int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSString *directory = [[NSString stringWithUTF8String:argv[1]] stringByAppendingPathComponent:@"DayFrame.iconset"];
        [NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:nil];
        for (NSNumber *size in @[@16, @32, @128, @256, @512]) for (NSNumber *scale in @[@1, @2]) {
            CGFloat edge = size.intValue * scale.intValue;
            NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithBitmapDataPlanes:NULL pixelsWide:edge pixelsHigh:edge bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSCalibratedRGBColorSpace bytesPerRow:0 bitsPerPixel:0];
            [NSGraphicsContext saveGraphicsState];
            NSGraphicsContext.currentContext = [NSGraphicsContext graphicsContextWithBitmapImageRep:bitmap];
            [[NSColor colorWithCalibratedRed:0.14 green:0.15 blue:0.16 alpha:1] setFill];
            [[NSBezierPath bezierPathWithRoundedRect:NSMakeRect(edge*.09, edge*.09, edge*.82, edge*.82) xRadius:edge*.18 yRadius:edge*.18] fill];
            NSDictionary *attributes = @{ NSFontAttributeName:[NSFont systemFontOfSize:edge*.58 weight:NSFontWeightSemibold], NSForegroundColorAttributeName:NSColor.whiteColor };
            NSSize bounds = [@"D" sizeWithAttributes:attributes];
            [@"D" drawAtPoint:NSMakePoint((edge-bounds.width)/2, (edge-bounds.height)/2) withAttributes:attributes];
            [NSGraphicsContext restoreGraphicsState];
            NSString *name = [NSString stringWithFormat:@"icon_%@x%@%@.png", size, size, scale.intValue == 2 ? @"@2x" : @""];
            [[bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}] writeToFile:[directory stringByAppendingPathComponent:name] atomically:YES];
        }
    }
    return 0;
}
