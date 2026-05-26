// 1. Перемикаємось на базу spotify
db = db.getSiblingDB("spotify");

// Видаляємо стару колекцію tracks, якщо вона існує
db.tracks.drop();

// Запускаємо конвеєр агрегації для трансформації даних
db.tracks_raw.aggregate([
  {
    $project: {
      // 2. Проєкція потрібних полів
      track_id: 1,
      track_name: 1,
      album_name: 1,
      explicit: 1,
      popularity: 1,
      duration_ms: 1,
      track_genre: 1,

      // Перетворення артистів:
      // Беремо поле "$artists" (рядок), ріжемо по ";" і очищаємо від пробілів.
      // Результат записуємо назад у поле "artists", тепер це буде повноцінний масив.
      artists: {
        $map: {
          input: { $split: ["$artists", ";"] },
          as: "artist",
          in: { $trim: { input: "$$artist" } }
        }
      },

      // Формування вкладеного об'єкта audio_features
      audio_features: {
        danceability: "$danceability",
        energy: "$energy",
        loudness: "$loudness",
        speechiness: "$speechiness",
        acousticness: "$acousticness",
        instrumentalness: "$instrumentalness",
        liveness: "$liveness",
        valence: "$valence",
        tempo: "$tempo",
        key: "$key",
        mode: "$mode",
        time_signature: "$time_signature"
      },

      // Додавання поля duration_sec (тривалість в секундах, округлена до 1 знака)
      duration_sec: {
        $round: [{ $divide: ["$duration_ms", 1000] }, 1]
      },

      // Додавання поля popularity_tier
      popularity_tier: {
        $switch: {
          branches: [
            { case: { $gte: ["$popularity", 70] }, then: "high" },
            { case: { $gte: ["$popularity", 40] }, then: "medium" }
          ],
          default: "low"
        }
      }
    }
  },
  // 6. Збереження результату в нову колекцію tracks
  { $out: "tracks" }
]);

// 7. Перевірка результату
const count = db.tracks.countDocuments();
print(`\n✅ Трансформацію завершено. Кількість документів у колекції tracks: ${count}\n`);

if (count > 0) {
    print("📄 Приклад згенерованого документа:");
    printjson(db.tracks.findOne());
} else {
    print("❌ Помилка: Колекція tracks порожня. Перевірте назву вихідної колекції (зараз 'tracks_raw').");
}