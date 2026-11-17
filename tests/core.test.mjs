import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, STYLES, resolveStyle, systemPrompt, copyablePrompt, validateEndpoint, requestBody, readReply, loadSettings } from '../src/core.ts';

test('random never repeats the previous style, including edge random values', () => {
  for (const previous of Object.keys(STYLES)) {
    for (const random of [0, 0.2, 0.5, 0.99, 1]) {
      const next = resolveStyle('random', previous, () => random);
      assert.notEqual(next, previous);
      assert.ok(Object.hasOwn(STYLES, next));
    }
  }
  assert.equal(resolveStyle('gentle', 'gentle'), 'gentle');
});

test('styles produce distinct instructions while preserving character and user boundaries', () => {
  const prompts = Object.keys(STYLES).map(style => systemPrompt(style, 'medium'));
  assert.equal(new Set(prompts).size, 6);
  for (const prompt of prompts) {
    assert.match(prompt, /Preserve any supplied character/);
    assert.match(prompt, /Do not write actions, dialogue/);
  }
  assert.match(copyablePrompt('  Hello  ', 'gentle', 'short'), /Message or draft:\nHello$/);
});

test('only explicit input is sent; API key and other settings never enter the request body', () => {
  const settings = { ...DEFAULTS, apiKey: 'secret-test-key', model: 'test-model', endpoint: 'https://example.com/v1/chat/completions' };
  const raw = requestBody('A specific message', 'casual', settings);
  const body = JSON.parse(raw);
  assert.equal(body.messages.length, 2);
  assert.deepEqual(body.messages[1], { role: 'user', content: 'A specific message' });
  assert.equal(body.model, 'test-model');
  assert.equal(body.stream, false);
  assert.ok(!raw.includes(settings.apiKey));
  assert.ok(!raw.includes(settings.endpoint));
  assert.throws(() => requestBody(' ', 'casual', settings), /Enter a message/);
  assert.throws(() => requestBody('hello', 'casual', DEFAULTS), /Set a model/);
});

test('endpoint validation allows TLS and local HTTP but rejects insecure remote endpoints and URL credentials', () => {
  for (const url of ['https://example.com/v1/chat/completions', 'http://localhost:1234/v1/chat/completions', 'http://127.0.0.1:8080/chat', 'http://[::1]:1234/chat']) assert.equal(validateEndpoint(url), url);
  for (const url of ['', 'not a url', 'http://example.com/chat', 'file:///tmp/file', 'https://key@example.com/chat', 'https://example.com/chat?key=secret', 'https://example.com/chat#key']) assert.throws(() => validateEndpoint(url));
});

test('response parsing accepts text and rejects malformed or empty provider responses', () => {
  assert.equal(readReply({ choices: [{ message: { content: ' Hello! ' } }] }), 'Hello!');
  for (const value of [null, {}, { choices: [] }, { choices: [{ message: { content: '' } }] }, { choices: [{ message: { content: [] } }] }]) assert.throws(() => readReply(value), /no text reply/);
});

test('invalid persisted settings safely fall back to defaults', () => {
  assert.deepEqual(loadSettings(null), DEFAULTS);
  assert.deepEqual(loadSettings({ style: 'invalid', length: 'huge', apiKey: 3, lastStyle: 'toString' }), DEFAULTS);
  assert.equal(loadSettings({ style: 'random', length: 'short', apiKey: 'my-key' }).style, 'random');
});
