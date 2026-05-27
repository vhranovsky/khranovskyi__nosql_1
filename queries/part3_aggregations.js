db = db.getSiblingDB("spotify");

// Завдання 1. Топ-10 виконавців за середньою популярністю
db.tracks.aggregate([
  // Розгортаємо масив артистів, щоб коректно врахувати кожного виконавця окремо
  { $unwind: "$artists" },

  // Групуємо треки за іменем виконавця та рахуємо статистику
  {
    $group: {
      _id: "$artists",                            // Групуємо по імені артиста
      total_tracks: { $sum: 1 },                  // Рахуємо кількість треків артиста
      avg_popularity: { $avg: "$popularity" }     // Рахуємо середню популярність
    }
  },

  // Фільтруємо групи: залишаємо лише тих, у кого є хоча б 5 треків
  {
    $match: {
      total_tracks: { $gte: 5 }
    }
  },

  // Формуємо красивий вивід полів та округляємо середнє значення
  {
    $project: {
      _id: 0,                                     // Ховаємо системний _id
      artist_name: "$_id",                        // Перейменовуємо у зрозуміле поле
      avg_popularity: { $round: ["$avg_popularity", 1] } // Округлюємо до 1 знака після коми
    }
  },

  // Сортуємо за середньою популярністю у порядку спадання
  { $sort: { avg_popularity: -1 } },

  // Обмежуємо результат топ-10 виконавцями
  { $limit: 10 }
]);


// Завдання 2. Розподіл треків за настроєм
db.tracks.aggregate([
  // Визначаємо настрій для кожного документа
  {
    $project: 
    {
      mood: 
      {
        $switch: 
        {
          branches: 
          [
            // високий valence (>= 0.5) + висока energy (>= 0.5) -> happy
            {
              case: 
              {
                $and: 
                [
                  { $gte: ["$audio_features.valence", 0.5] },
                  { $gte: ["$audio_features.energy", 0.5] }
                ]
              },
              then: "happy"
            },
            // низький valence (< 0.5) + висока energy (>= 0.5) -> angry
            {
              case: 
              {
                $and: 
                [
                  { $lt: ["$audio_features.valence", 0.5] },
                  { $gte: ["$audio_features.energy", 0.5] }
                ]
              },
              then: "angry"
            },
            // високий valence (>= 0.5) + низька energy (< 0.5) -> calm
            {
              case: 
              {
                $and: 
                [
                  { $gte: ["$audio_features.valence", 0.5] },
                  { $lt: ["$audio_features.energy", 0.5] }
                ]
              },
              then: "calm"
            }
          ],
          // якщо не підійшов жоден з варіантів, це низький valence + низька energy -> sad
          default: "sad"
        }
      }
    }
  },

  // Рахуємо кількість треків у кожній категорії настрою
  {
    $group: 
    {
      _id: "$mood",
      track_count: { $sum: 1 }
    }
  },

  // Робимо назви колонок зрозумілими
  {
    $project: 
    {
      _id: 0,
      mood: "$_id",
      track_count: 1
    }
  },

  // Сортуємо за кількістю треків (від найбільшої групи до найменшої)
  { $sort: { track_count: -1 } }
]);


// Завдання 3. Найбільш «танцювальний» жанр
db.tracks.aggregate([
  // Групуємо всі треки за жанрами та рахуємо агреговані метрики
  {
    $group: 
    {
      _id: "$track_genre",                             // Групуємо за назвою жанру
      track_count: { $sum: 1 },                        // Рахуємо кількість треків у жанрі
      avg_danceability: { $avg: "$audio_features.danceability" }, // Середня танцювальність
      avg_energy: { $avg: "$audio_features.energy" },             // Середня енергія
      avg_valence: { $avg: "$audio_features.valence" }            // Середня позитивність
    }
  },

  // Фільтруємо жанри за умовою статистичної надійності (мінімум 100 треків)
  {
    $match: 
    {
      track_count: { $gte: 100 }
    }
  },

  // Форматуємо вивід полів та округляємо середні значення до 3 знаків після коми
  {
    $project: 
    {
      _id: 0,                                          // Ховаємо внутрішній системний _id
      genre: "$_id",                                   // Перейменовуємо робочий _id назад у "genre"
      track_count: 1,
      avg_danceability: { $round: ["$avg_danceability", 3] },
      avg_energy: { $round: ["$avg_energy", 3] },
      avg_valence: { $round: ["$avg_valence", 3] }
    }
  },

  // Сортуємо результат за спаданням танцювальності, щоб нагорі опинився найкращий жанр
  { $sort: { avg_danceability: -1 } },

  // Оскільки нам потрібно визначити конкретний жанр, що підходить найкраще, лімітуємо вивід топ-10
  { $limit: 10 }
]);