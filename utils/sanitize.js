const MAX_LENGTH = 200;

// Remove dangerous characters and limit length
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    // Trim whitespace
    let sanitized = input.trim();
    // Remove line breaks and control characters
    sanitized = sanitized.replace(/[\r\n]/g, ' ').replace(/[\x00-\x1f\x7f]/g, '');
    // Limit length to prevent huge prompts
    if (sanitized.length > MAX_LENGTH) {
        sanitized = sanitized.substring(0, MAX_LENGTH - 3) + '...';
    }
    return sanitized;
}

module.exports = { sanitizeInput };