# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | ✅ Active support  |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue
2. Email the maintainers or use GitHub's private vulnerability reporting
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work on a fix.

## Security Measures

iPmartGit implements the following security measures:

- Password hashing with bcrypt (10 salt rounds)
- Session-based authentication with HTTP-only cookies
- Rate limiting on API endpoints
- Input validation and sanitization
- Access control for private repositories
- CSRF protection via same-origin policy
- Security headers via Nginx (X-Frame-Options, X-Content-Type-Options)

## Best Practices for Deployment

1. Change the default admin password immediately
2. Set a strong `SESSION_SECRET` environment variable
3. Use HTTPS in production (configure SSL in Nginx)
4. Keep Node.js and dependencies updated
5. Restrict server access with firewall rules
6. Regular database backups
