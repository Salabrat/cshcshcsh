// Load Hero Content for All Users
(function() {
    'use strict';
    
    function preloadImage(url) {
        return new Promise((resolve) => {
            if (!url || typeof url !== 'string') return resolve(false);
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    }
    
    // Load saved hero content
    async function loadHeroContent() {
        try {
            const response = await fetch('/api/hero-content');
            if (!response.ok) {
                console.error('Failed to fetch hero content');
                return;
            }
            
            const content = await response.json();
            console.log('Loaded hero content:', content);
            
            // Update hero title
            const heroTitle = document.querySelector('.hero-title');
            if (heroTitle && content.title && heroTitle.dataset.homepageTextsOverride !== 'true') {
                heroTitle.innerHTML = content.title;
                console.log('Updated hero title:', content.title);
            }
            
            // Update hero subtitle
            const heroSubtitle = document.querySelector('.hero-subtitle');
            if (heroSubtitle && content.subtitle && heroSubtitle.dataset.homepageTextsOverride !== 'true') {
                heroSubtitle.textContent = content.subtitle;
                console.log('Updated hero subtitle:', content.subtitle);
            }
            
            // Update button text - try multiple selectors
            const heroButton = document.querySelector('[data-text-id="hero-btn"]') || 
                             document.querySelector('.hero-content .btn') || 
                             document.querySelector('.hero .btn-white');
            if (heroButton && content.buttonText) {
                heroButton.textContent = content.buttonText;
                console.log('Updated hero button text:', content.buttonText);
            } else if (!heroButton) {
                console.error('Hero button not found!');
            }
            
            // Update button link
            if (heroButton && content.buttonLink) {
                const parentLink = heroButton.closest('a');
                if (parentLink) {
                    parentLink.href = content.buttonLink;
                    console.log('Updated hero button link:', content.buttonLink);
                } else if (heroButton.tagName === 'A') {
                    heroButton.href = content.buttonLink;
                    console.log('Updated hero button link:', content.buttonLink);
                }
            }
            
            // Update background image or video
            const heroSection = document.querySelector('.hero, .hero-section');
            const heroImg = document.querySelector('.hero-image img, .hero img, .hero-background');
            const heroImageContainer = document.querySelector('.hero-image') || heroSection;
            
            if (content.mediaType === 'video' && content.backgroundVideo) {
                // Handle video background
                let videoUrl = content.backgroundVideo;
                if (videoUrl.startsWith('/uploads/')) {
                    videoUrl = window.location.origin + videoUrl;
                } else if (!videoUrl.startsWith('http')) {
                    videoUrl = window.location.origin + '/' + videoUrl;
                }
                
                console.log('Setting hero video src to:', videoUrl);
                
                // Remove background image from section
                if (heroSection) {
                    heroSection.style.backgroundImage = 'none';
                }
                
                // Hide existing img element
                if (heroImg) {
                    heroImg.style.display = 'none';
                }
                
                // Create or reuse video element
                let heroVideo = heroImageContainer.querySelector('.hero-background-video');
                if (!heroVideo) {
                    heroVideo = document.createElement('video');
                    heroVideo.className = 'hero-background-video';
                    heroVideo.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;';
                    heroVideo.muted = true;
                    heroVideo.loop = true;
                    heroVideo.playsInline = true;
                    heroVideo.autoplay = true;
                    heroVideo.setAttribute('playsinline', '');
                    heroVideo.setAttribute('webkit-playsinline', '');
                    heroImageContainer.insertBefore(heroVideo, heroImageContainer.firstChild);
                }
                heroVideo.src = videoUrl;
                heroVideo.load();
                heroVideo.play().catch(err => console.warn('Hero video autoplay blocked:', err));
                heroVideo.style.display = 'block';
                
            } else if (content.backgroundImage) {
                // Handle image background
                let imageUrl = content.backgroundImage;
                
                // If it starts with /uploads/, use it as is
                if (imageUrl.startsWith('/uploads/')) {
                    imageUrl = window.location.origin + imageUrl;
                }
                // If it's a full URL (http/https), use it as is
                else if (!imageUrl.startsWith('http')) {
                    // Assume it's relative to the current domain
                    imageUrl = window.location.origin + '/' + imageUrl;
                }

                const ok = await preloadImage(imageUrl);
                if (!ok) {
                    console.warn('Hero background image failed to preload, still attempting to set:', imageUrl);
                }
                
                // Remove any existing video element
                const existingVideo = heroImageContainer.querySelector('.hero-background-video');
                if (existingVideo) {
                    existingVideo.pause();
                    existingVideo.remove();
                }
                
                // Update background image on section (so hero fills even before <img> loads)
                if (heroSection) {
                    heroSection.style.backgroundImage = `url('${imageUrl}')`;
                    heroSection.style.backgroundSize = 'cover';
                    heroSection.style.backgroundPosition = 'center';
                }
                
                // Update img src if exists
                if (heroImg) {
                    console.log('Setting hero img src to:', imageUrl);
                    heroImg.src = imageUrl;
                    heroImg.alt = content.title ? content.title.replace(/<br>/g, ' ') : 'Hero Image';
                    // Force visibility
                    heroImg.style.display = 'block';
                    heroImg.style.visibility = 'visible';
                } else {
                    console.warn('Hero img element not found with selector .hero-image img, .hero img, .hero-background');
                }
            }
            
            console.log('Hero content loaded successfully');
            window._heroContentLoaded = true;
        } catch (error) {
            console.error('Error loading hero content:', error);
        }
    }
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadHeroContent);
    } else {
        loadHeroContent();
    }
})();
