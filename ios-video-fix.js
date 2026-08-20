/**
 * iOS Video Autoplay Fix v4
 *
 * Root causes on iOS:
 * 1. Large base64 data:video/ URLs fail silently on iOS WebView (size limit)
 * 2. iOS requires playsinline + muted for autoplay
 * 3. Telegram WebView may need user interaction to unlock playback
 *
 * This script:
 * - Converts data:video URLs to Blob URLs (fixes iOS data URL size limit)
 * - Sets all required iOS attributes (without removing/replacing existing src)
 * - Retries playback on user interaction
 * - Generates poster frame via canvas as visual fallback
 * - MutationObserver catches dynamically added videos
 */
(function () {
    'use strict';

    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    var pendingVideos = [];

    // Convert base64 data URL to Blob URL (fixes iOS data URL size limits)
    function dataUrlToBlob(dataUrl) {
        try {
            var parts = dataUrl.split(',');
            var mime = parts[0].match(/:(.*?);/)[1];
            var bstr = atob(parts[1]);
            var n = bstr.length;
            var u8arr = new Uint8Array(n);
            for (var i = 0; i < n; i++) {
                u8arr[i] = bstr.charCodeAt(i);
            }
            return URL.createObjectURL(new Blob([u8arr], { type: mime }));
        } catch (e) {
            console.warn('[ios-video-fix] Failed to convert data URL to blob:', e);
            return null;
        }
    }

    // Fix data URL sources on iOS
    function fixDataUrlSource(video) {
        var src = video.src || video.getAttribute('src') || '';

        // Check <source> elements too
        if (!src) {
            var sourceEl = video.querySelector('source');
            if (sourceEl) src = sourceEl.src || sourceEl.getAttribute('src') || '';
        }

        if (src && src.indexOf('data:video/') === 0) {
            var blobUrl = dataUrlToBlob(src);
            if (blobUrl) {
                video._originalDataUrl = src;
                video.src = blobUrl;
                // Remove any <source> elements with data URLs
                var sources = video.querySelectorAll('source');
                for (var i = 0; i < sources.length; i++) {
                    var sSrc = sources[i].src || sources[i].getAttribute('src') || '';
                    if (sSrc.indexOf('data:video/') === 0) {
                        sources[i].src = blobUrl;
                    }
                }
                return true;
            }
        }
        return false;
    }

    function applyIOSAttributes(video) {
        if (video._iosFixed) return;
        video._iosFixed = true;

        // Apply all iOS-required attributes (DO NOT touch src or add <source>)
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('muted', '');
        video.setAttribute('autoplay', '');
        video.setAttribute('preload', 'auto');
        video.setAttribute('x-webkit-airplay', 'allow');
        video.playsInline = true;
        video.muted = true;
        video.defaultMuted = true;
        video.autoplay = true;
        try { video.disableRemotePlayback = true; } catch (e) {}

        // Fix data URL videos (critical for iOS)
        var wasDataUrl = fixDataUrlSource(video);

        // Event listeners
        video.addEventListener('loadeddata', function () {
            tryPlay(video);
            generatePoster(video);
        });

        video.addEventListener('canplay', function () {
            tryPlay(video);
        });

        video.addEventListener('loadedmetadata', function () {
            setTimeout(function () { tryPlay(video); }, 50);
        });

        // If source was changed (data URL → blob), reload
        if (wasDataUrl) {
            video.load();
        }

        // Try to play
        tryPlay(video);
        setTimeout(function () { tryPlay(video); }, 300);
        setTimeout(function () { tryPlay(video); }, 1000);
        setTimeout(function () { tryPlay(video); }, 3000);
    }

    function tryPlay(video) {
        if (!video || !video.parentNode) return;
        video.muted = true;
        try {
            var p = video.play();
            if (p && typeof p.then === 'function') {
                p.then(function () {
                    video._isPlaying = true;
                    var idx = pendingVideos.indexOf(video);
                    if (idx > -1) pendingVideos.splice(idx, 1);
                }).catch(function () {
                    if (pendingVideos.indexOf(video) === -1) {
                        pendingVideos.push(video);
                    }
                    generatePoster(video);
                });
            }
        } catch (e) {
            if (pendingVideos.indexOf(video) === -1) {
                pendingVideos.push(video);
            }
        }
    }

    function generatePoster(video) {
        if (video._posterGenerated || video.poster) return;
        if (!video.videoWidth || !video.videoHeight) return;
        try {
            var canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            if (dataUrl && dataUrl.length > 200) {
                video.poster = dataUrl;
                video._posterGenerated = true;
            }
        } catch (e) {}
    }

    function onUserInteraction() {
        // Play all pending videos
        var videos = pendingVideos.slice();
        pendingVideos.length = 0;
        for (var i = 0; i < videos.length; i++) {
            tryPlay(videos[i]);
        }
        // Also try ALL videos on the page
        var allVideos = document.querySelectorAll('video');
        for (var j = 0; j < allVideos.length; j++) {
            if (allVideos[j].paused) tryPlay(allVideos[j]);
        }
    }

    function processExistingVideos() {
        var videos = document.querySelectorAll('video');
        for (var i = 0; i < videos.length; i++) {
            applyIOSAttributes(videos[i]);
        }
    }

    // MutationObserver: catch dynamically added videos
    function startObserver() {
        if (typeof MutationObserver === 'undefined') return;
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var added = mutations[i].addedNodes;
                if (!added) continue;
                for (var j = 0; j < added.length; j++) {
                    var node = added[j];
                    if (node.nodeName === 'VIDEO') {
                        applyIOSAttributes(node);
                    } else if (node.querySelectorAll) {
                        var vids = node.querySelectorAll('video');
                        for (var k = 0; k < vids.length; k++) {
                            applyIOSAttributes(vids[k]);
                        }
                    }
                }
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Periodic retry
    function startPeriodicRetry() {
        var count = 0;
        var interval = setInterval(function () {
            count++;
            if (count > 30) { clearInterval(interval); return; }
            var videos = document.querySelectorAll('video');
            for (var i = 0; i < videos.length; i++) {
                if (videos[i].paused && videos[i].readyState >= 2) {
                    tryPlay(videos[i]);
                }
            }
        }, 1000);
    }

    // Also intercept data URL video sources set AFTER page load
    // by patching the video src setter in localStorage design settings
    function fixDesignSettingsDataUrls() {
        try {
            var raw = localStorage.getItem('tg_miniapp_design_settings');
            if (!raw) return;
            var settings = JSON.parse(raw);
            var changed = false;

            // Fix catalogCovers
            if (Array.isArray(settings.catalogCovers)) {
                settings.catalogCovers = settings.catalogCovers.map(function (item) {
                    if (typeof item === 'object' && item.url && item.url.indexOf('data:video/') === 0) {
                        var blobUrl = dataUrlToBlob(item.url);
                        if (blobUrl) {
                            changed = true;
                            return { url: blobUrl, type: item.type || 'video', _wasBlobConverted: true };
                        }
                    }
                    return item;
                });
            }

            // Fix logoImages
            if (Array.isArray(settings.logoImages)) {
                settings.logoImages = settings.logoImages.map(function (item) {
                    var url = typeof item === 'string' ? item : (item && item.url);
                    if (url && url.indexOf('data:video/') === 0) {
                        var blobUrl = dataUrlToBlob(url);
                        if (blobUrl) {
                            changed = true;
                            if (typeof item === 'string') return blobUrl;
                            return { url: blobUrl, type: item.type || 'video', _wasBlobConverted: true };
                        }
                    }
                    return item;
                });
            }

            // Fix loadingScreenImage
            if (settings.loadingScreenImage && settings.loadingScreenImage.indexOf('data:video/') === 0) {
                var blobUrl = dataUrlToBlob(settings.loadingScreenImage);
                if (blobUrl) {
                    settings.loadingScreenImage = blobUrl;
                    changed = true;
                }
            }

            // Fix rouletteBannerMedia
            if (settings.rouletteBannerMedia && settings.rouletteBannerMedia.url &&
                settings.rouletteBannerMedia.url.indexOf('data:video/') === 0) {
                var blobUrl2 = dataUrlToBlob(settings.rouletteBannerMedia.url);
                if (blobUrl2) {
                    settings.rouletteBannerMedia.url = blobUrl2;
                    changed = true;
                }
            }

            // Note: we do NOT write back to localStorage because blob URLs are session-only
            // Instead, we update the in-memory window objects
            if (changed) {
                if (window.catalogCoverImages) {
                    window.catalogCoverImages = settings.catalogCovers;
                }
            }
        } catch (e) {}
    }

    function init() {
        // Fix data URLs in design settings before videos are created
        fixDesignSettingsDataUrls();

        processExistingVideos();
        startObserver();

        ['touchstart', 'touchend', 'click', 'pointerdown', 'pointerup'].forEach(function (evt) {
            document.addEventListener(evt, onUserInteraction, { passive: true });
        });

        startPeriodicRetry();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                fixDesignSettingsDataUrls();
                processExistingVideos();
            });
        }
        window.addEventListener('load', function () {
            processExistingVideos();
            setTimeout(processExistingVideos, 500);
            setTimeout(processExistingVideos, 2000);
        });
    }

    window._iosVideoFix = {
        applyToVideo: applyIOSAttributes,
        tryPlay: tryPlay,
        processAll: processExistingVideos,
        dataUrlToBlob: dataUrlToBlob,
        isIOS: isIOS
    };

    init();
})();
