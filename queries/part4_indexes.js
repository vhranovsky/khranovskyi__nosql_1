db = db.getSiblingDB("spotify");

// Завдання 1. Аналіз запиту та індексація
// Аналіз плану виконання БЕЗ індексів;
const res1 = db.tracks.find({
  track_genre: "pop",
  "audio_features.danceability": { $gte: 0.7 }
}).sort({ popularity: -1 }).explain("executionStats");
print(res1.executionStats);

// Створення оптимального складеного індексу
// Використовуємо правило ESR (Equality, Sort, Range):
// 1. track_genre - точний збіг (Equality)
// 2. popularity: -1 - сортування (Sort)
// 3. audio_features.danceability - діапазон (Range)
db.tracks.createIndex({
  track_genre: 1,
  popularity: -1,
  "audio_features.danceability": 1
});

// Аналіз плану виконання ПІСЛЯ створення індексу
const res2 = db.tracks.find({
  track_genre: "pop",
  "audio_features.danceability": { $gte: 0.7 }
}).sort({ popularity: -1 }).explain("executionStats");
print(res2.executionStats);

// Завдання 2. Індекс для інших полів

// Створення оптимального складеного індексу за правилом ESR
db.tracks.createIndex({
  explicit: 1,
  "audio_features.instrumentalness": 1,
  "audio_features.speechiness": 1
});

// Запуск пошуку для фонової роботи з аналізом плану виконання
// Використовуємо find() разом із explain
const res3 = db.tracks.find({
  explicit: false, // або "False" залежно від типу даних у вашому датасеті
  "audio_features.instrumentalness": { $gt: 0.5 },
  "audio_features.speechiness": { $lt: 0.1 }
}).explain("executionStats");

// Виводимо статистику виконання на екран
print(res3.executionStats);