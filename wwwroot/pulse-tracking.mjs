export function lockFacePatch(anchor, detected, threshold = .045) {
    if (!anchor) return {box:{...detected},motion:0,restarted:false};
    const motion = Math.max(
        Math.hypot(detected.originX-anchor.originX,detected.originY-anchor.originY)/anchor.width,
        Math.abs(detected.width-anchor.width)/anchor.width,
        Math.abs(detected.height-anchor.height)/anchor.height);
    // A fixed patch avoids replacing skin pixels with every detector jitter.
    // Compare against its original anchor so slow accumulated movement also resets.
    return motion>threshold
        ? {box:{...detected},motion,restarted:true}
        : {box:anchor,motion,restarted:false};
}

export function displayEstimate(result) {
    return {
        bpm:Number.isFinite(result.bpm)?String(result.bpm):'—',
        status:result.status==='Collecting'
            ? `Collecting · ${Math.min(20,Math.floor(result.seconds))}/20 seconds`
            : result.status,
        detail:result.detail||'Still checking for a clear signal.'
    };
}
