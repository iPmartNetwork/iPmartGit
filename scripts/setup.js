const fs = require('fs');
const path = require('path');

console.log('ðŸš€ iPmartGit Setup');
console.log('==================');

// Create necessary directories
const dirs = [
  'repositories',
  'uploads',
  'uploads/temp',
  'uploads/releases',
  'git-repos',
  'db'
];

dirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`âœ… Created: ${dir}/`);
  } else {
    console.log(`ðŸ“ Exists: ${dir}/`);
  }
});

// Initialize database
console.log('\nðŸ“¦ Initializing database...');
const db = require('../db/database');

db.initPromise.then(() => {
  console.log('âœ… Database ready');
  console.log('\n==================');
  console.log('âœ… Setup complete!');
  console.log('\nðŸ“‹ Default admin credentials:');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  console.log('\nâš ï¸  Please change the admin password after first login!');
  console.log('\nðŸš€ Start the server with: npm start');
  console.log('   Or for development: npm run dev');
  process.exit(0);
}).catch(err => {
  console.error('âŒ Database initialization failed:', err.message);
  process.exit(1);
});
