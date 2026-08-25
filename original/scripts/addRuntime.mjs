import fs from 'fs';
import path from 'path';

// Mapping de películas con su duración (en minutos)
// Basado en datos de TMDB aproximados
const runtimeMap = {
  "10 cosas que odio de ti": 97,
  "12 Años de Esclavitud": 134,
  "1917": 119,
  "20,000 leguas de viaje submarino": 116,
  "21 Blackjack": 123,
  "4 meses, 3 semanas, 2 días": 156,
  "(500) días con ella": 95,
  "60 Segundos": 118,
  "65: Al borde de la extinción": 93,
  "8 Minutos antes de morir": 91,
  "Abracadabra": 101,
  "Abracadabra 2": 104,
  "Actividad Paranormal 2": 91,
  "Actividad Paranormal 3": 104,
  "Actividad Paranormal 4": 88,
  "Aladdín": 90,
  "Aladdín: El regreso de Jafar": 68,
  "Aladdin": 125,
  "Alerta en lo Profundo": 97,
  "Alicia en el país de las maravillas": 110,
  "Alien: Covenant": 122,
  "Amigos Intocables": 112,
  "Amor ciego": 101,
  "Animatrix": 102,
  "Annabelle": 99,
  "Antes de Partir": 124,
  "Aquaman": 143,
  "Arma Mortal": 109,
  "Arma Mortal 2": 118,
  "Arma Mortal 3": 118,
  "Arma Mortal 4": 127,
  "Armageddon": 150,
  "Arrástrame al infierno": 100,
  "Atlas": 134,
  "Atrápame si puedes": 141,
  "Avatar": 162,
  "Avengers: Endgame": 181,
  "Aviones": 91,
  "Babe, el puerquito valiente": 89,
  "Bajo La Misma Estrella": 125,
  "Bambi": 70,
  "Batman": 126,
  "Batman regresa": 126,
  "Belleza Americana": 122,
  "Ben-Hur": 212,
  "Billy Elliot": 110,
  "Black Mirror: Bandersnatch": 90,
  "Black Widow": 134,
  "Blade Runner 2049": 163,
  "Buscando a Dory": 97,
  "Buscando a Nemo": 100,
  "Búsqueda implacable 2": 91,
  "Cadena de Favores": 99,
  "Calabozos y dragones": 134,
  "Cambio De Hábito": 110,
  "Capitán Phillips": 134,
  "Cars": 116,
  "Cars 2": 120,
  "Cars 3": 102,
  "Casino Royale": 144,
  "Chappie": 120,
  "Cheque en blanco": 91,
  "Chicas Pesadas": 130,
  "Chicken Little": 81,
  "Chip y Dale: Al rescate": 96,
  "Coco": 105,
  "Cocodrilo Dundee": 97,
  "Constantine": 121,
  "Contacto": 150,
  "Corre.": 95,
  "Cortocircuito 2": 111,
  "Cristiada": 145,
  "Cuarto de guerra": 118,
  "Cuenta Conmigo": 87,
  "Cómo entrenar a tu dragón": 98,
  "Cómo entrenar a tu dragón 2": 102,
  "Cómo Entrenar A Tu Dragón 3": 104,
  "Daniel el Travieso": 101,
  "De mendigo a millonario": 117,
  "Desde mi cielo": 121,
  "Desde el Infierno": 122,
  "Desencantada": 111,
  "Destino Final": 98,
  "Destino Final 2": 90,
  "Destino Final 3": 93,
  "Destino Final 4": 93,
  "Destino Final 5": 92,
  "Diario de una pasión": 123,
  "Dinosaurio": 82,
  "Dios no está muerto 2": 120,
  "Doctor Sueño": 152,
  "Dragon Ball Super: Super Hero": 100,
  "Dragon Ball Z: La Resurrección de Freezer": 95,
  "Dredd": 95,
  "Duro de matar 2": 128,
  "Déjà Vu": 126,
  "El amo del viento": 82,
  "El Bueno, El Malo y El Feo": 161,
  "El Cabo del Miedo": 128,
  "El caldero mágico": 80,
  "El chofer de la señora Daisy": 99,
  "El Cielo Puede Esperar": 101,
  "El Código Da Vinci": 149,
  "El Color Púrpura": 154,
  "El Conjuro 2": 134,
  "El Curioso Caso de Benjamin Button": 167,
  "El Diario De La Princesa": 115,
  "El Exorcista": 132,
  "El fugitivo": 130,
  "El Gran Milagro": 118,
  "El Gran Truco": 116,
  "El Grinch": 104,
  "El Guardaespaldas": 129,
  "El Hombre Bicentenario": 131,
  "El Hombre Invisible": 124,
  "El increíble castillo vagabundo": 119,
  "El juego de Ender": 114,
  "El Libro de la Selva": 88,
  "El mago de los sueños": 108,
  "El Negociador": 128,
  "El pasajero": 104,
  "El Principito": 96,
  "El Protector": 104,
  "El protegido": 107,
  "El rey león": 87,
  "El Rito": 109,
  "El ritual": 93,
  "El sexto día": 110,
  "El Silencio de los Inocentes": 118,
  "El smoking": 84,
  "El Transportador 3": 104,
  "El viaje de Chihiro": 125,
  "El aro": 115,
  "El cadáver de la novia": 76,
  "El castillo en el cielo": 124,
  "El código enigma": 119,
  "El día después de mañana": 124,
  "El diablo viste a la moda": 110,
  "El ejército de los muertos": 148,
  "El expreso polar": 100,
  "El gigante de hierro": 86,
  "El gran Showman": 105,
  "El Hombre del Norte": 137,
  "El jorobado de Notre Dame": 84,
  "El laberinto del fauno": 118,
  "El libro de la selva": 106,
  "El Libro de la Vida": 95,
};

async function addRuntimeToMovies() {
  try {
    const filePath = './movies.json';
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    console.log(`Procesando ${data.length} películas...`);

    let updated = 0;
    let notFound = 0;

    data.forEach((movie) => {
      const title = movie.title || '';
      
      if (runtimeMap[title]) {
        movie.runtime = runtimeMap[title];
        updated++;
      } else {
        // Asignar duración por defecto (0 o null)
        if (!movie.runtime) {
          movie.runtime = 0;
          notFound++;
        }
      }
    });

    // Guardar archivo actualizado
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    console.log(`✓ Archivo actualizado exitosamente`);
    console.log(`  - Películas con duración asignada: ${updated}`);
    console.log(`  - Películas sin duración encontrada: ${notFound}`);
    console.log(`  - Total de películas: ${data.length}`);
    console.log(`\nArchivo guardado: ${filePath}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addRuntimeToMovies();
