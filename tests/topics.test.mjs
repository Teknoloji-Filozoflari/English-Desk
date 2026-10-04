import test from "node:test";
import assert from "node:assert/strict";
import { validateNotebook } from "../src/model.ts";
import {
  DEFAULT_EXAM_TOPICS,
  validateTopics,
  mergeTopics,
} from "../src/topics.ts";
import { removeExamTopic, examTopicId } from "../src/exams.ts";
import {
  makeBackup,
  parseBackup,
  planRestore,
  emptyNotebook,
} from "../src/backup-core.ts";
import { notebookFixture } from "./e2e/fixture.mjs";
test("topic validation rejects duplicate titles, invalid links and multiple grammar placements", () => {
  assert.throws(() =>
    validateTopics([
      { id: "a", title: "Reading" },
      { id: "b", title: "reading" },
    ]),
  );
  const data = notebookFixture();
  data.grammarTopics = [{ id: "g-topic", title: "Bağlaçlar" }];
  data.grammar = [{ id: "g", title: "Not", body: "Örnek", topicId: "missing" }];
  assert.throws(() => validateNotebook(data));
  data.grammar[0].topicId = "g-topic";
  data.grammar[0].tense = "Present Simple";
  assert.throws(() => validateNotebook(data));
  const invalid = notebookFixture();
  invalid.exams.tests[0].topicId = "missing";
  assert.throws(() => validateNotebook(invalid));
});
test("deleting a built-in exam topic preserves tests, attempts, answers and detaches legacy memberships", () => {
  const data = notebookFixture().exams;
  data.attempts = [
    {
      id: "attempt",
      test: data.tests[0],
      mode: "study",
      answers: { q1: "book" },
      flags: ["q2"],
      position: 1,
      elapsed: 30,
      finished: false,
      created: 100,
    },
  ];
  const removed = removeExamTopic(data, "osym");
  assert.equal(removed.tests.length, 1);
  assert.equal(removed.attempts.length, 1);
  assert.equal(examTopicId(removed.tests[0]), "");
  assert.equal(examTopicId(removed.attempts[0].test), "");
  assert.deepEqual(removed.attempts[0].answers, { q1: "book" });
  assert.equal(data.tests[0].topicId, undefined);
  assert.ok(!removed.topics.some((t) => t.id === "osym"));
  assert.doesNotThrow(() =>
    validateNotebook({ ...notebookFixture(), exams: removed }),
  );
});
test("selected backups carry empty topics, match names and remap colliding IDs including exam snapshots", () => {
  const incoming = notebookFixture();
  incoming.grammarTopics = [
    { id: "shared", title: "Bağlaçlar" },
    { id: "empty", title: "Boş başlık" },
  ];
  incoming.grammar = [
    { id: "note", title: "Not", body: "Çalışma", topicId: "shared" },
  ];
  incoming.exams.topics = [{ id: "shared", title: "Benim sınavım" }];
  incoming.exams.tests[0].topicId = "shared";
  incoming.exams.attempts = [
    {
      id: "attempt",
      test: incoming.exams.tests[0],
      mode: "study",
      answers: { q1: "book" },
      flags: [],
      position: 0,
      elapsed: 0,
      finished: false,
      created: 100,
    },
  ];
  const current = emptyNotebook();
  current.grammarTopics = [
    { id: "shared", title: "Başka konu" },
    { id: "linked", title: "Bağlaçlar" },
  ];
  current.exams.topics = [{ id: "shared", title: "Başka sınav" }];
  const bundle = parseBackup(
    makeBackup(incoming, {
      sections: ["grammar", "exams"],
      includeAudio: false,
    }),
  );
  const result = planRestore(current, bundle, {
    sections: ["grammar", "exams"],
    mode: "merge",
  }).data;
  assert.equal(result.grammar[0].topicId, "linked");
  assert.ok(result.grammarTopics.some((t) => t.title === "Boş başlık"));
  const examId = result.exams.topics.find(
    (t) => t.title === "Benim sınavım",
  ).id;
  assert.notEqual(examId, "shared");
  assert.equal(result.exams.tests[0].topicId, examId);
  assert.equal(result.exams.attempts[0].test.topicId, examId);
  assert.deepEqual(
    planRestore(result, bundle, {
      sections: ["grammar", "exams"],
      mode: "merge",
    }).data,
    result,
  );
  const replaced = planRestore(current, bundle, {
    sections: ["grammar"],
    mode: "replace",
  }).data;
  assert.deepEqual(replaced.grammarTopics, incoming.grammarTopics);
  assert.deepEqual(replaced.exams, current.exams);
  assert.equal(
    mergeTopics(DEFAULT_EXAM_TOPICS, [{ id: "x", title: "IELTS" }]).ids.get(
      "x",
    ),
    "ielts",
  );
});

test("guide headings can be removed/restored and their notes move safely to general, including backups", async () => {
  const { removeGuideTopic, restoreGuideTopic } =
    await import("../src/grammar-guide.ts");
  for (const [section, field, topic] of [
    ["tenses", "tense", "Present Simple"],
    ["modality", "modality", "3.1 Ability (yetenek)"],
  ]) {
    const data = notebookFixture();
    data.grammar = [
      { id: "guide-note", title: "Kendi notum", body: "Örnek", [field]: topic },
    ];
    const removed = removeGuideTopic(data, section, topic);
    assert.equal(removed.grammar[0][field], undefined);
    assert.equal(data.grammar[0][field], topic);
    assert.ok(removed.hiddenGrammarTopics[section].includes(topic));
    assert.doesNotThrow(() => validateNotebook(removed));
    const bundle = parseBackup(
      makeBackup(removed, { sections: ["grammar"], includeAudio: false }),
    );
    assert.deepEqual(
      planRestore(emptyNotebook(), bundle, {
        sections: ["grammar"],
        mode: "replace",
      }).data.hiddenGrammarTopics,
      removed.hiddenGrammarTopics,
    );
    const restored = restoreGuideTopic(removed, section, topic);
    assert.equal(restored.hiddenGrammarTopics[section].length, 0);
    assert.equal(restored.grammar[0][field], undefined);
  }
  assert.throws(() =>
    validateNotebook({
      ...notebookFixture(),
      hiddenGrammarTopics: { tenses: ["invalid"], modality: [] },
    }),
  );
});
