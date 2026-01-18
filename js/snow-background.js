document.addEventListener('DOMContentLoaded', () => {
    const snowContainer = document.createElement('div');
    snowContainer.className = 'snow-container';
    document.body.prepend(snowContainer);

    const snowflakes = 50; // Number of snowflakes

    for (let i = 0; i < snowflakes; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        
        const snowflakeChars = ['❄', '❅', '❆'];
        snowflake.innerHTML = snowflakeChars[Math.floor(Math.random() * snowflakeChars.length)];
        
        const size = Math.random() * 20 + 10; // 10px to 30px
        snowflake.style.fontSize = `${size}px`;
        
        const leftPosition = Math.random() * 100;
        snowflake.style.left = `${leftPosition}%`;
        
        const animationDuration = Math.random() * 10 + 10; // 10s to 20s
        snowflake.style.animationDuration = `${animationDuration}s`;
        
        const animationDelay = Math.random() * 10;
        snowflake.style.animationDelay = `${animationDelay}s`;

        // Add horizontal drift
        const drift = (Math.random() - 0.5) * 200; // -100px to 100px
        snowflake.style.setProperty('--horizontal-drift', `${drift}px`);

        snowContainer.appendChild(snowflake);
    }
});
