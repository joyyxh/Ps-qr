// Owner sign-up, sign-in and recovery screens: the messages they show and the live password checklist.
// The server enforces the same rules (owner-auth-function.test.js); these checks cover what the owner reads.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  passwordChecklist,
  recoveryCodesText,
  regenerateErrorMessage,
  resetErrorMessage,
  signInErrorMessage,
  signUpErrorMessage,
} from '../src/logic.js';
import { checkPassword, checkUsername, normalizeRecoveryCode, PASSWORD_RULE_TEXT } from '../src/owner-rules.js';

const serverError = (code, message = '') => Object.assign(new Error(message), { code, status: 400 });

test('sign-up messages name the problem without blaming the owner', () => {
  assert.equal(signUpErrorMessage(serverError('username_taken')), 'That username is already taken. Choose another.');
  assert.match(signUpErrorMessage(serverError('terms_required')), /current Terms and Privacy Policy/);
  assert.equal(signUpErrorMessage(new TypeError('Failed to fetch')).includes('internet connection'), true);
  assert.equal(signUpErrorMessage(serverError('username_chars', 'Use letters a to z.')), 'Use letters a to z.');
  assert.equal(signUpErrorMessage(serverError('weird', 'Something new happened.')), 'Something new happened.');
});

test('a wrong username and a wrong password read the same on sign-in', () => {
  assert.equal(signInErrorMessage(serverError('invalid_credentials')), 'That username or password is not right.');
  assert.match(signInErrorMessage(serverError('rate_limited')), /15 minutes/);
});

test('reset and regenerate messages match the server codes', () => {
  assert.equal(resetErrorMessage(serverError('reset_failed')), 'That username or recovery code is not right.');
  assert.match(resetErrorMessage(serverError('password_rejected', 'That password is not accepted.')), /not accepted/);
  assert.equal(regenerateErrorMessage(serverError('password_incorrect')), 'The current password is not right.');
  assert.match(regenerateErrorMessage(serverError('session_required')), /Sign in again/);
});

test('the password checklist lists every rule and marks the ones that are met', () => {
  const empty = passwordChecklist('', 'ada_01');
  assert.deepEqual(
    empty.map((item) => item.key),
    ['length', 'bytes', 'upper', 'lower', 'digit', 'username']
  );
  assert.equal(empty.find((item) => item.key === 'length').met, false);
  assert.equal(empty.find((item) => item.key === 'bytes').met, true);

  const strong = passwordChecklist('Correct-Horse-9', 'ada_01');
  assert.ok(strong.every((item) => item.met), 'every rule is met by a strong password');

  const withName = passwordChecklist('Ada_01-Secure9', 'ada_01');
  assert.equal(withName.find((item) => item.key === 'username').met, false, 'a password may not contain the username');
  assert.equal(Object.keys(PASSWORD_RULE_TEXT).length, 6, 'one message per rule');
  assert.equal(PASSWORD_RULE_TEXT['length'], 'At least 10 characters', 'the length rule names the minimum');
});

test('usernames and passwords are checked the same way in the browser', () => {
  assert.deepEqual(checkUsername('  Ada_01 '), { ok: true, username: 'ada_01' });
  assert.equal(checkUsername('admin').code, 'username_reserved');
  assert.equal(checkUsername('1ada').code, 'username_chars');
  assert.equal(checkUsername('ab').code, 'username_length');
  assert.deepEqual(checkPassword('short', 'ada').failures.sort(), ['digit', 'length', 'upper'].sort());
  assert.equal(checkPassword('Correct-Horse-9', 'ada_01').ok, true);
});

test('recovery codes are read with or without dashes and in any case', () => {
  assert.equal(normalizeRecoveryCode('abcd-efgh-jkmn-pqrs'), 'ABCDEFGHJKMNPQRS');
  assert.equal(normalizeRecoveryCode('ABCD EFGH JKMN PQRS'), 'ABCDEFGHJKMNPQRS');
  assert.equal(normalizeRecoveryCode('ABCD-EFGH-JKMN-PQRO'), null, 'O is not in the alphabet');
  assert.equal(normalizeRecoveryCode('ABCD'), null);
});

test('the saved-codes text holds every code once and names the account', () => {
  const codes = Array.from({ length: 10 }, (_, i) => `AAAA-BBBB-CCCC-DD${String(i).padStart(2, '0')}`);
  const text = recoveryCodesText('ada_01', codes);
  assert.match(text, /Account: ada_01/);
  for (const code of codes) assert.equal(text.split(code).length, 2, `${code} appears once`);
  assert.match(text, /^10\. /m);
});
