// Load social links from site settings
(async function() {
    try {
        const response = await fetch('/api/site-settings');
        if (response.ok) {
            const settings = await response.json();
            const socialLinks = settings.socialLinks || {};
            
            // Update Telegram link
            const telegramLink = document.getElementById('social-telegram');
            if (telegramLink) {
                if (socialLinks.telegram) {
                    telegramLink.href = socialLinks.telegram;
                    telegramLink.style.display = '';
                } else {
                    telegramLink.style.display = 'none';
                }
            }
            
            // Update VK link
            const vkLink = document.getElementById('social-vk');
            if (vkLink) {
                if (socialLinks.vk) {
                    vkLink.href = socialLinks.vk;
                    vkLink.style.display = '';
                } else {
                    vkLink.style.display = 'none';
                }
            }
            
            // Update Instagram link
            const instagramLink = document.getElementById('social-instagram');
            if (instagramLink) {
                if (socialLinks.instagram) {
                    instagramLink.href = socialLinks.instagram;
                    instagramLink.style.display = '';
                } else {
                    instagramLink.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('Error loading social links:', error);
    }
})();
