export async function resizeViewport(driver, width, height, { timeout = 10000, pollInterval = 200 } = {}) {
  await driver.wait(async () => {
    const viewport = await driver.executeScript('return {innerWidth, innerHeight, outerWidth, outerHeight};');
    if (Math.abs(viewport.innerWidth - width) <= 1 && Math.abs(viewport.innerHeight - height) <= 1) return true;
    // Firefox can change its chrome insets while resizing. Recalculate from
    // the current dimensions instead of waiting forever on the first estimate.
    await driver.manage().window().setRect({
      width: width + viewport.outerWidth - viewport.innerWidth,
      height: height + viewport.outerHeight - viewport.innerHeight,
    });
    return false;
  }, timeout, `Viewport must reach ${width}×${height}`, pollInterval);
}
