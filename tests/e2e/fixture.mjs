// Synthetic study material only. Never load the user's data directory.
export function notebookFixture() {
  return {
    version: 1,
    stories: [
      {
        id: "story-test",
        title: "A quiet morning",
        text: "The garden is quiet. Emma reads a book.",
        level: "A1",
        read: false,
      },
    ],
    words: [],
    grammar: [],
    storyNotes: [],
    exams: {
      tests: [
        {
          id: "exam-test",
          exam: "YDS",
          collection: "osym",
          title: "Tarayıcı test sınavı",
          section: "Karma",
          source: "Test verisi",
          minutes: 5,
          questions: [
            {
              id: "q1",
              prompt: "Choose the word for kitap.",
              passage: "",
              kind: "choice",
              options: ["book", "garden", "quiet"],
              answer: "book",
              explanation: "Book means kitap.",
            },
            {
              id: "q2",
              prompt: "Choose the word for bahçe.",
              passage: "",
              kind: "choice",
              options: ["garden", "morning", "read"],
              answer: "garden",
              explanation: "Garden means bahçe.",
            },
          ],
        },
      ],
      attempts: [],
    },
  };
}
