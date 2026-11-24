// Change the email and/or password of an EXISTING account (admin or user).
//
//   node change-credentials.js
//
// It asks for everything interactively and never prints or stores the
// passwords anywhere except as a bcrypt hash in the database.
// (seed.js only CREATES accounts that don't exist yet, so changing the
// values in .env later does nothing for accounts that already exist.)

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Don't echo what is typed
      rl._writeToOutput = function (str) {
        if (str.includes(question)) rl.output.write(str);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

(async () => {
  await connectDB();

  const current = (await ask('Current login email of the account to change: ')).toLowerCase().trim();
  const user = await User.findOne({ email: current });
  if (!user) {
    console.log('No account found with that email.');
    process.exit(1);
  }
  console.log(`Found ${user.role} account.`);

  const newEmail = (await ask('New email (press Enter to keep the same): ')).toLowerCase().trim();
  const newPass = await ask('New password (press Enter to keep the same): ', { hidden: true });

  if (!newEmail && !newPass) {
    console.log('Nothing to change.');
    process.exit(0);
  }

  if (newPass) {
    if (newPass.length < 10) {
      console.log('Password must be at least 10 characters.');
      process.exit(1);
    }
    const again = await ask('Type the new password again: ', { hidden: true });
    if (again !== newPass) {
      console.log('Passwords did not match. Nothing changed.');
      process.exit(1);
    }
    user.passwordHash = await bcrypt.hash(newPass, 12);
  }

  if (newEmail && newEmail !== user.email) {
    const taken = await User.findOne({ email: newEmail });
    if (taken) {
      console.log('That email is already used by another account.');
      process.exit(1);
    }
    user.email = newEmail;
  }

  await user.save();
  console.log('Updated. You can now log in with the new details.');
  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});