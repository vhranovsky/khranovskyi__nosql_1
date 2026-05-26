db = db.getSiblingDB("spotify");

//Завдання 1. Треки для вечірки
db.tracks.find(
    {
        // Енергійність та танцювальність
        "audio_features.danceability": { $gt: 0.7 },
        "audio_features.energy": { $gt: 0.7 },
  
        // Тривалість треку в мілісекундах (від 3 до 5 хвилин)
        duration_ms: { $gte: 180000, $lte: 300000 }
    }, 
    {
        _id: 0,
        track_name: 1,
        artists: 1,
        album_name: 1,
        "audio_features.danceability": 1,
        "audio_features.energy": 1,
        duration_ms: 1
    }
).limit(10); // Обмежуємо вивід першими 10 треками для перевірки


//Завдання 2. Виконавці, у яких усі треки популярні
db.tracks.aggregate([
  // Розгортаємо масив артистів. Якщо у треку 3 артисти, створиться 3 копії документа — по одній на кожного артиста.
  { $unwind: "$artists" },

  // Групуємо всі треки за іменем артиста та рахуємо агреговані метрики
  {
    $group: 
    {
        _id: "$artists",                            // Групуємо по очищеному імені артиста
        total_tracks: { $sum: 1 },                  // Рахуємо загальну кількість треків артиста
        min_popularity: { $min: "$popularity" },    // Знаходимо найменшу популярність серед його треків
        avg_popularity: { $avg: "$popularity" }     // Знаходимо середню популярність
    }
  },

  // Фільтруємо групи
  {
    $match: 
    {
        total_tracks: { $gte: 3 },                  // Мінімум 3 треки
        min_popularity: { $gte: 60 }                // Мінімальна популярність 60 або вище
    }
  },

  // Округляємо середню популярність до одного знака після коми
  {
    $project: 
    {
        _id: 0,                                     // Ховаємо внутрішній системний _id групи
        artist_name: "$_id",                        // Перейменовуємо _id у зрозуміле ім'я артиста
        total_tracks: 1,
        min_popularity: 1,
        avg_popularity: { $round: ["$avg_popularity", 1] } // Округлення до 1 знака
    }
  },

  // Сортуємо результат за середньою популярністю у порядку спадання
  { $sort: { avg_popularity: -1, total_tracks: -1 } },

  // Лімітуємо вивід топ-20 артистами
  { $limit: 20 }
]);


//Завдання 3. Нетипові треки
db.tracks.aggregate([
  // Групуємо всі треки за жанром, рахуємо статистики та збираємо всі документи в масив
  {
    $group: 
    {
        _id: "$track_genre",
        avg_tempo: { $avg: "$audio_features.tempo" },
        std_dev: { $stdDevPop: "$audio_features.tempo" },
        // Тимчасово зберігаємо всі треки жанру в масиві для подальшої фільтрації
        all_tracks: { $push: "$$ROOT" }
    }
  },

  // Розраховуємо поріг аномалії (outlier_threshold = avg + 2 * std_dev)
  {
    $addFields: 
    {
      outlier_threshold: 
      { 
            $add: ["$avg_tempo", { $multiply: [2, "$std_dev"] }] 
      }
    }
  },

  // Фільтруємо масив треків прямо в пам'яті, залишаючи лише ті, у яких tempo > поріг
  {
    $project: 
    {
        _id: 0,
        genre: "$_id", // Перейменовуємо робочий _id у "genre"
        avg_tempo: { $round: ["$avg_tempo", 1] }, // Округляємо середній темп
        outlier_threshold: { $round: ["$outlier_threshold", 1] }, // Округляємо поріг
        
        // Фільтруємо масив треків за допомогою $filter
        outlier_tracks: 
        {
            $filter: 
            {
                input: "$all_tracks",
                as: "track",
                cond: { $gt: ["$$track.audio_features.tempo", "$outlier_threshold"] }
            }
        }
    }
  },

  // Трансформуємо структуру всередині масиву аномальних треків під твій формат
  {
    $project: 
    {
        genre: 1,
        avg_tempo: 1,
        outlier_threshold: 1,
        outlier_tracks: 
        {
            $map: 
            {
                input: "$outlier_tracks",
                as: "t",
                in: 
                {
                    _id: "$$t._id",
                    track_name: "$$t.track_name",
                    popularity: "$$t.popularity",
                    artists: "$$t.artists",
                    audio_features: 
                    {
                        tempo: "$$t.audio_features.tempo"
                    }
                }
            }
        }
    }
  },

  // Відсікаємо жанри, у яких немає жодного нетипового треку
  {
    $match: 
    {
        "outlier_tracks.0": { $exists: true }
    }
  },

  // Сортуємо жанри за алфавітом
  { $sort: { genre: 1 } }
]);


// Завдання 4: Треки для фонової роботи
db.tracks.find(
    {
        // Характеристики звуку з вкладеного об'єкта
        "audio_features.loudness": { $lt: -10 },          // Тихі треки (менше ніж -10 дБ)
        "audio_features.speechiness": { $lt: 0.1 },       // Низький вміст мовлення
        "audio_features.instrumentalness": { $gt: 0.5 },  // Переважно інструментальна музика
        
        // Без нецензурного або дорослого контенту
        explicit: false                                   
    }, 
    {
        // Проєкція: виводимо тільки релевантні поля для перевірки
        _id: 0,
        track_name: 1,
        artists: 1,
        track_genre: 1,
        explicit: 1,
        "audio_features.loudness": 1,
        "audio_features.speechiness": 1,
        "audio_features.instrumentalness": 1
    }
).limit(10); // Обмежуємо вивід 10 треками для зручності перевірки