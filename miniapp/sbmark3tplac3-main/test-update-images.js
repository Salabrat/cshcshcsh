// Test script to update homepage images
const fs = require('fs');
const path = require('path');

// Path to homepage images file
const HOMEPAGE_IMAGES_FILE = path.join(__dirname, 'homepage-images.json');

// Test image URLs from uploaded files
const testImages = {
    "hero": "/uploads/image-1761167535332-249013270.jpg",
    "campaign1": "/uploads/image-1761163274663-985218661.jpg",
    "campaign2": "/uploads/image-1760911553403-549473061.jpg",
    "campaign3": "/uploads/image-1760911553443-12403570.jpg",
    "about1": "/uploads/image-1760911553454-743660235.jpg",
    "about2": "/uploads/image-1760911553463-63433728.jpg"
};

// Update the file
fs.writeFileSync(HOMEPAGE_IMAGES_FILE, JSON.stringify(testImages, null, 2));

console.log('Homepage images updated successfully!');
console.log('Updated images:', testImages);
