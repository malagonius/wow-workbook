import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRichText } from '../js/rich-text.js';

test('rich descriptions render bold markup and line breaks', () => {
  assert.equal(formatRichText('Deal **heavy damage**.\nThen retreat.'), 'Deal <strong>heavy damage</strong>.<br>Then retreat.');
});

test('rich descriptions escape HTML before adding supported formatting', () => {
  assert.equal(formatRichText('<img src=x onerror=alert(1)> **safe**'), '&lt;img src=x onerror=alert(1)&gt; <strong>safe</strong>');
});

test('rich descriptions preserve Windows line endings as visual breaks', () => {
  assert.equal(formatRichText('First\r\nSecond'), 'First<br>Second');
});
