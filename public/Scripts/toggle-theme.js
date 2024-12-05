// Toggle Theme Button
const toggleButton = document.getElementById('theme-toggle');

// Set initial state based on saved theme or default
const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
toggleButton.classList.add(currentTheme);

// Handle theme toggle
toggleButton.addEventListener('click', () => {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update button appearance
    toggleButton.classList.remove('light', 'dark');
    toggleButton.classList.add(newTheme);
});