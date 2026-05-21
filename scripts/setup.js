const fs = require('fs');
const path = require('path');

console.log('🚀 iPmartGit Setup');
console.log('==================');

// Create necessary directories
const dirs = [
  'repositories',
  'uploads',
  'uploads/temp',
  'db'
];

dirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Created: ${dir}/`);
  } else {
    console.log(`📁 Exists: ${dir}/`);
  }
});

// Initialize database
console.log('\n📦 Initializing database...');
require('../db/database');
console.log('✅ Database ready');

console.log('\n==================');
console.log('✅ Setup complete!');
console.log('\n📋 Default admin credentials:');
console.log('   Username: admin');
console.log('   Password: admin123');
console.log('\n⚠️  Please change the admin password after first login!');
console.log('\n🚀 Start the server with: npm start');
console.log('   Or for development: npm run dev');
