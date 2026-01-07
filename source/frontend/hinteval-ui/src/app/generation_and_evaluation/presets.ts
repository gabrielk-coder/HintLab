export const PRESET_DATA: Record<string, any> = {
  "What is the capital of Brazil?": {
    question: "What is the capital of Brazil?",
    groundTruth: "Brasília",
    hints: [
      { hint_text: "It is a planned city founded in 1960.", hint_id: 1 },
      { hint_text: "It is located in the Federal District.", hint_id: 2 },
      { hint_text: "It was designed by Oscar Niemeyer and Lúcio Costa.", hint_id: 3 },
      { hint_text: "It replaced Rio de Janeiro as the capital.", hint_id: 4 }
    ],
    candidates: {
      candidate_texts: [
        "Rio de Janeiro", "São Paulo", "Salvador",
        "Belo Horizonte", "Curitiba", "Brasília"
      ],
      is_groundtruth_candidate: "Brasília"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "Which planet is known as the Red Planet?": {
    question: "Which planet is known as the Red Planet?",
    groundTruth: "Mars",
    hints: [
      { hint_text: "It is the fourth planet from the Sun.", hint_id: 5 },
      { hint_text: "It has two small moons named Phobos and Deimos.", hint_id: 6 },
      { hint_text: "Its surface is rich in iron oxide, giving it a rusty color.", hint_id: 7 },
      { hint_text: "It is named after the Roman god of war.", hint_id: 8 }
    ],
    candidates: {
      candidate_texts: [
        "Venus", "Jupiter", "Saturn", "Mercury", "Neptune", "Mars"
      ],
      is_groundtruth_candidate: "Mars"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "Who wrote The Hobbit?": {
    question: "Who wrote The Hobbit?",
    groundTruth: "J.R.R. Tolkien",
    hints: [
      { hint_text: "He was a professor of Anglo-Saxon at Oxford University.", hint_id: 9 },
      { hint_text: "He also wrote The Lord of the Rings trilogy.", hint_id: 10 },
      { hint_text: "He is often considered the father of modern high fantasy literature.", hint_id: 11 },
      { hint_text: "His initials are J.R.R.", hint_id: 12 }
    ],
    candidates: {
      candidate_texts: [
        "J.K. Rowling", "C.S. Lewis", "George R.R. Martin",
        "Roald Dahl", "Isaac Asimov", "J.R.R. Tolkien"
      ],
      is_groundtruth_candidate: "J.R.R. Tolkien"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "What is the tallest mountain in the world?": {
    question: "What is the tallest mountain in the world?",
    groundTruth: "Mount Everest",
    hints: [
      { hint_text: "It is located in the Mahalangur Himal sub-range of the Himalayas.", hint_id: 13 },
      { hint_text: "It sits on the border between Nepal and China.", hint_id: 14 },
      { hint_text: "Its peak is 8,848 meters above sea level.", hint_id: 15 },
      { hint_text: "It is named after a British Surveyor General of India.", hint_id: 16 }
    ],
    candidates: {
      candidate_texts: [
        "K2", "Mount Kilimanjaro", "Denali",
        "Mount Fuji", "Mont Blanc", "Mount Everest"
      ],
      is_groundtruth_candidate: "Mount Everest"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "Who discovered penicillin?": {
    question: "Who discovered penicillin?",
    groundTruth: "Alexander Fleming",
    hints: [
      { hint_text: "He was a Scottish physician and microbiologist.", hint_id: 17 },
      { hint_text: "The discovery happened accidentally in 1928.", hint_id: 18 },
      { hint_text: "He noticed a mold killed bacteria.", hint_id: 19 },
      { hint_text: "He won the Nobel Prize in 1945.", hint_id: 20 }
    ],
    candidates: {
      candidate_texts: [
        "Marie Curie", "Louis Pasteur", "Charles Darwin",
        "Albert Einstein", "Isaac Newton", "Alexander Fleming"
      ],
      is_groundtruth_candidate: "Alexander Fleming"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "What is the largest ocean on Earth?": {
    question: "What is the largest ocean on Earth?",
    groundTruth: "Pacific Ocean",
    hints: [
      { hint_text: "It covers more than 30% of Earth's surface.", hint_id: 21 },
      { hint_text: "Named by Ferdinand Magellan.", hint_id: 22 },
      { hint_text: "Contains the Mariana Trench.", hint_id: 23 },
      { hint_text: "Separates Asia from the Americas.", hint_id: 24 }
    ],
    candidates: {
      candidate_texts: [
        "Atlantic Ocean", "Indian Ocean", "Arctic Ocean",
        "Southern Ocean", "Mediterranean Sea", "Pacific Ocean"
      ],
      is_groundtruth_candidate: "Pacific Ocean"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "What is the chemical symbol for Gold?": {
    question: "What is the chemical symbol for Gold?",
    groundTruth: "Au",
    hints: [
      { hint_text: "From Latin 'Aurum'.", hint_id: 25 },
      { hint_text: "Atomic number 79.", hint_id: 26 },
      { hint_text: "Used in jewelry.", hint_id: 27 },
      { hint_text: "Starts with A.", hint_id: 28 }
    ],
    candidates: {
      candidate_texts: ["Ag", "Fe", "Pb", "Cu", "Pt", "Au"],
      is_groundtruth_candidate: "Au"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "Who painted the Mona Lisa?": {
    question: "Who painted the Mona Lisa?",
    groundTruth: "Leonardo da Vinci",
    hints: [
      { hint_text: "Italian polymath.", hint_id: 29 },
      { hint_text: "Displayed in the Louvre.", hint_id: 30 },
      { hint_text: "Painted The Last Supper.", hint_id: 31 },
      { hint_text: "First name Leonardo.", hint_id: 32 }
    ],
    candidates: {
      candidate_texts: [
        "Michelangelo", "Raphael", "Vincent van Gogh",
        "Pablo Picasso", "Rembrandt", "Leonardo da Vinci"
      ],
      is_groundtruth_candidate: "Leonardo da Vinci"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "What is the powerhouse of the cell?": {
    question: "What is the powerhouse of the cell?",
    groundTruth: "Mitochondria",
    hints: [
      { hint_text: "Organelle in most cells.", hint_id: 33 },
      { hint_text: "Produces energy.", hint_id: 34 },
      { hint_text: "Generates ATP.", hint_id: 35 },
      { hint_text: "Has its own DNA.", hint_id: 36 }
    ],
    candidates: {
      candidate_texts: [
        "Nucleus", "Ribosome", "Lysosome",
        "Golgi apparatus", "Cytoplasm", "Mitochondria"
      ],
      is_groundtruth_candidate: "Mitochondria"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "Who was the first person to walk on the Moon?": {
    question: "Who was the first person to walk on the Moon?",
    groundTruth: "Neil Armstrong",
    hints: [
      { hint_text: "Apollo 11 commander.", hint_id: 37 },
      { hint_text: "Famous quote.", hint_id: 38 },
      { hint_text: "American astronaut.", hint_id: 39 },
      { hint_text: "With Buzz Aldrin.", hint_id: 40 }
    ],
    candidates: {
      candidate_texts: [
        "Buzz Aldrin", "Yuri Gagarin", "Michael Collins",
        "Alan Shepard", "John Glenn", "Neil Armstrong"
      ],
      is_groundtruth_candidate: "Neil Armstrong"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "What is the largest mammal in the world?": {
    question: "What is the largest mammal in the world?",
    groundTruth: "Blue Whale",
    hints: [
      { hint_text: "Marine mammal.", hint_id: 41 },
      { hint_text: "Eats krill.", hint_id: 42 },
      { hint_text: "Huge heart.", hint_id: 43 },
      { hint_text: "Very loud.", hint_id: 44 }
    ],
    candidates: {
      candidate_texts: [
        "African Elephant", "Great White Shark", "Giraffe",
        "Colossal Squid", "Orca", "Blue Whale"
      ],
      is_groundtruth_candidate: "Blue Whale"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "What is the capital of Japan?": {
    question: "What is the capital of Japan?",
    groundTruth: "Tokyo",
    hints: [
      { hint_text: "Formerly Edo.", hint_id: 45 },
      { hint_text: "Shibuya Crossing.", hint_id: 46 },
      { hint_text: "2020 Olympics.", hint_id: 47 },
      { hint_text: "Most populous metro.", hint_id: 48 }
    ],
    candidates: {
      candidate_texts: [
        "Kyoto", "Osaka", "Seoul", "Beijing", "Bangkok", "Tokyo"
      ],
      is_groundtruth_candidate: "Tokyo"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "What is the currency of the United Kingdom?": {
    question: "What is the currency of the United Kingdom?",
    groundTruth: "Pound Sterling",
    hints: [
      { hint_text: "Symbol £.", hint_id: 49 },
      { hint_text: "Oldest currency.", hint_id: 50 },
      { hint_text: "Issued by BoE.", hint_id: 51 },
      { hint_text: "100 pence.", hint_id: 52 }
    ],
    candidates: {
      candidate_texts: [
        "Euro", "US Dollar", "Japanese Yen",
        "Swiss Franc", "Indian Rupee", "Pound Sterling"
      ],
      is_groundtruth_candidate: "Pound Sterling"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "What is the freezing point of water in Celsius?": {
    question: "What is the freezing point of water in Celsius?",
    groundTruth: "0°C",
    hints: [
      { hint_text: "Turns water to ice.", hint_id: 53 },
      { hint_text: "32°F.", hint_id: 54 },
      { hint_text: "Celsius reference.", hint_id: 55 },
      { hint_text: "Single digit.", hint_id: 56 }
    ],
    candidates: {
      candidate_texts: [
        "100°C", "-273°C", "32°C", "10°C", "-10°C", "0°C"
      ],
      is_groundtruth_candidate: "0°C"
    },
    metricsById: {},
    eliminationMap: {}
  },

  "Who wrote the play 'Romeo and Juliet'?": {
    question: "Who wrote the play 'Romeo and Juliet'?",
    groundTruth: "William Shakespeare",
    hints: [
      { hint_text: "English playwright.", hint_id: 57 },
      { hint_text: "Bard of Avon.", hint_id: 58 },
      { hint_text: "Globe Theatre.", hint_id: 59 },
      { hint_text: "Also wrote Hamlet.", hint_id: 60 }
    ],
    candidates: {
      candidate_texts: [
        "Charles Dickens", "Jane Austen", "Mark Twain",
        "Homer", "Ernest Hemingway", "William Shakespeare"
      ],
      is_groundtruth_candidate: "William Shakespeare"
    },
    metricsById: {},
    eliminationMap: {}
  }
};
