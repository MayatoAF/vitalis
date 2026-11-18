import type { Food, Nutrition100, Portion } from './types';

type Row = [name: string, category: string, kcal: number, carbs: number, protein: number, fat: number, fiber: number, portions?: Portion[]];

const P = (label: string, grams: number): Portion => ({ label, grams });
const COLHER = (g: number) => P('1 colher de sopa', g);

/** Valores de referência aproximados por 100 g / 100 ml (base TACO/USDA). */
const ROWS: Row[] = [
  // Cereais, grãos e tubérculos
  ['Arroz branco cozido', 'Cereais', 128, 28.1, 2.5, 0.2, 1.6, [P('1 escumadeira', 80), P('1 prato raso', 150), COLHER(25)]],
  ['Arroz integral cozido', 'Cereais', 124, 25.8, 2.6, 1.0, 2.7, [P('1 escumadeira', 80), P('1 prato raso', 150)]],
  ['Feijão carioca cozido', 'Cereais', 76, 13.6, 4.8, 0.5, 8.5, [P('1 concha', 90), COLHER(25)]],
  ['Feijão preto cozido', 'Cereais', 77, 14.0, 4.5, 0.5, 8.4, [P('1 concha', 90)]],
  ['Lentilha cozida', 'Cereais', 116, 20.1, 9.0, 0.4, 7.9, [P('1 concha', 90)]],
  ['Pão francês', 'Cereais', 300, 58.6, 8.0, 3.1, 2.3, [P('1 unidade', 50), P('1 unidade pequena', 35)]],
  ['Pão de forma integral', 'Cereais', 253, 41.0, 9.4, 3.7, 6.9, [P('1 fatia', 25)]],
  ['Pão de queijo', 'Cereais', 330, 34.0, 8.0, 18.0, 1.0, [P('1 unidade', 20)]],
  ['Tapioca (goma)', 'Cereais', 240, 58.0, 0.5, 0.3, 1.0, [P('1 unidade média', 90)]],
  ['Cuscuz de milho cozido', 'Cereais', 113, 25.3, 2.4, 0.7, 2.1, [P('1 fatia', 100)]],
  ['Aveia em flocos', 'Cereais', 394, 66.6, 13.9, 8.5, 9.1, [COLHER(15), P('1 xícara', 80)]],
  ['Granola tradicional', 'Cereais', 421, 64.0, 10.0, 14.0, 6.0, [COLHER(20), P('1 xícara', 60)]],
  ['Macarrão cozido', 'Cereais', 158, 30.9, 5.8, 0.9, 1.8, [P('1 pegador', 110)]],
  ['Batata inglesa cozida', 'Cereais', 86, 20.1, 1.7, 0.1, 1.8, [P('1 unidade', 130)]],
  ['Batata-doce cozida', 'Cereais', 77, 18.4, 0.6, 0.1, 2.2, [P('1 unidade média', 150)]],
  ['Mandioca cozida', 'Cereais', 125, 30.1, 0.6, 0.3, 1.6, [P('1 pedaço', 100)]],
  ['Farofa pronta', 'Cereais', 400, 62.0, 3.0, 15.0, 3.0, [COLHER(20)]],
  ['Pipoca caseira (sem óleo)', 'Cereais', 387, 77.8, 12.9, 4.5, 14.5, [P('1 tigela', 25)]],
  ['Tapioca com queijo', 'Cereais', 280, 40.0, 8.0, 9.0, 1.0, [P('1 unidade', 110)]],

  // Frutas
  ['Banana prata', 'Frutas', 98, 26.0, 1.3, 0.1, 2.0, [P('1 unidade', 90)]],
  ['Banana nanica', 'Frutas', 92, 23.8, 1.4, 0.1, 1.9, [P('1 unidade', 100)]],
  ['Maçã com casca', 'Frutas', 56, 15.2, 0.3, 0.2, 1.3, [P('1 unidade', 160)]],
  ['Mamão papaia', 'Frutas', 40, 10.4, 0.5, 0.1, 1.0, [P('1 fatia', 150)]],
  ['Manga', 'Frutas', 64, 16.7, 0.4, 0.3, 1.6, [P('1 unidade', 200)]],
  ['Laranja', 'Frutas', 45, 11.5, 0.8, 0.1, 1.1, [P('1 unidade', 130)]],
  ['Morango', 'Frutas', 30, 6.8, 0.9, 0.3, 1.7, [P('1 xícara', 150)]],
  ['Uva itália', 'Frutas', 53, 13.6, 0.7, 0.2, 0.9, [P('1 cacho pequeno', 100)]],
  ['Abacaxi', 'Frutas', 48, 12.3, 0.9, 0.1, 1.0, [P('1 fatia', 130)]],
  ['Melancia', 'Frutas', 33, 8.1, 0.9, 0.2, 0.3, [P('1 fatia', 250)]],
  ['Abacate', 'Frutas', 96, 6.0, 1.2, 8.4, 6.3, [P('1/2 unidade', 100)]],
  ['Pera', 'Frutas', 53, 14.0, 0.6, 0.1, 3.0, [P('1 unidade', 180)]],
  ['Kiwi', 'Frutas', 51, 11.5, 1.3, 0.6, 2.7, [P('1 unidade', 80)]],
  ['Açaí polpa', 'Frutas', 58, 6.2, 0.8, 3.9, 2.6, [P('1 tigela', 200)]],
  ['Tangerina', 'Frutas', 38, 9.6, 0.7, 0.1, 0.9, [P('1 unidade', 100)]],

  // Verduras e legumes
  ['Alface', 'Vegetais', 11, 1.7, 1.3, 0.2, 1.7, [P('1 prato de folhas', 40)]],
  ['Tomate', 'Vegetais', 15, 3.1, 1.1, 0.2, 1.2, [P('1 unidade', 120)]],
  ['Brócolis cozido', 'Vegetais', 25, 4.4, 2.1, 0.5, 3.4, [P('1 xícara', 90)]],
  ['Cenoura crua', 'Vegetais', 34, 7.7, 1.3, 0.2, 3.2, [P('1 unidade', 80)]],
  ['Abobrinha cozida', 'Vegetais', 15, 3.0, 1.1, 0.2, 1.6, [P('1 xícara', 100)]],
  ['Couve refogada', 'Vegetais', 90, 5.0, 3.0, 6.0, 3.5, [COLHER(30)]],
  ['Salada de folhas com tomate', 'Vegetais', 22, 3.5, 1.2, 0.4, 1.6, [P('1 prato', 120)]],
  ['Pepino', 'Vegetais', 10, 2.0, 0.9, 0.1, 1.1, [P('1 unidade', 100)]],
  ['Beterraba cozida', 'Vegetais', 32, 7.2, 1.3, 0.1, 2.8, [P('1 fatia', 40)]],
  ['Quiabo cozido', 'Vegetais', 22, 4.8, 1.9, 0.2, 3.2, [P('1 xícara', 90)]],
  ['Chuchu cozido', 'Vegetais', 19, 4.8, 0.4, 0.1, 1.0, [P('1 xícara', 100)]],
  ['Vagem cozida', 'Vegetais', 25, 5.0, 1.8, 0.2, 3.0, [P('1 xícara', 90)]],

  // Proteínas
  ['Frango grelhado (peito)', 'Proteínas', 159, 0.0, 32.0, 2.5, 0.0, [P('1 filé', 120), P('1 filé grande', 180)]],
  ['Carne bovina (patinho grelhado)', 'Proteínas', 219, 0.0, 32.0, 9.0, 0.0, [P('1 bife', 100)]],
  ['Ovo cozido', 'Proteínas', 146, 0.6, 13.3, 9.5, 0.0, [P('1 unidade', 50)]],
  ['Ovo frito', 'Proteínas', 240, 0.6, 15.0, 18.0, 0.0, [P('1 unidade', 55)]],
  ['Atum em água', 'Proteínas', 116, 0.0, 26.0, 1.0, 0.0, [P('1 lata drenada', 120)]],
  ['Salmão grelhado', 'Proteínas', 208, 0.0, 22.0, 13.0, 0.0, [P('1 filé', 130)]],
  ['Tilápia grelhada', 'Proteínas', 128, 0.0, 26.0, 2.7, 0.0, [P('1 filé', 120)]],
  ['Sardinha em conserva', 'Proteínas', 208, 0.0, 24.0, 12.0, 0.0, [P('1 lata drenada', 100)]],
  ['Carne suína (lombo grelhado)', 'Proteínas', 210, 0.0, 28.0, 10.0, 0.0, [P('1 fatia', 100)]],
  ['Tofu firme', 'Proteínas', 76, 1.9, 8.1, 4.8, 0.3, [P('1 fatia', 100)]],
  ['Whey protein (pó)', 'Proteínas', 380, 8.0, 75.0, 5.0, 1.0, [P('1 scoop', 30)]],
  ['Peito de peru fatiado', 'Proteínas', 104, 1.5, 18.0, 2.5, 0.0, [P('1 fatia', 20)]],
  ['Lombo canadense', 'Proteínas', 110, 2.0, 18.0, 3.0, 0.0, [P('1 fatia', 15)]],

  // Laticínios
  ['Leite integral', 'Laticínios', 61, 4.7, 3.2, 3.3, 0.0, [P('1 copo', 200), P('1 copo americano', 150)]],
  ['Leite desnatado', 'Laticínios', 35, 5.0, 3.2, 0.2, 0.0, [P('1 copo', 200)]],
  ['Iogurte natural integral', 'Laticínios', 51, 4.0, 3.9, 2.5, 0.0, [P('1 pote', 170)]],
  ['Iogurte grego zero', 'Laticínios', 59, 4.0, 9.0, 0.5, 0.0, [P('1 pote', 130)]],
  ['Queijo minas frescal', 'Laticínios', 264, 3.0, 17.4, 20.2, 0.0, [P('1 fatia', 30)]],
  ['Queijo muçarela', 'Laticínios', 330, 2.0, 22.0, 25.0, 0.0, [P('1 fatia', 25)]],
  ['Requeijão cremoso', 'Laticínios', 257, 2.0, 5.0, 25.0, 0.0, [COLHER(20)]],
  ['Cream cheese', 'Laticínios', 250, 4.0, 5.0, 24.0, 0.0, [COLHER(20)]],
  ['Manteiga', 'Laticínios', 717, 0.1, 0.9, 81.0, 0.0, [P('1 ponta de faca', 10)]],

  // Bebidas
  ['Café sem açúcar', 'Bebidas', 2, 0.3, 0.2, 0.0, 0.0, [P('1 xícara', 50)]],
  ['Café com leite (sem açúcar)', 'Bebidas', 40, 4.0, 2.2, 2.0, 0.0, [P('1 xícara', 150)]],
  ['Suco de laranja natural', 'Bebidas', 45, 10.4, 0.7, 0.1, 0.2, [P('1 copo', 200)]],
  ['Refrigerante comum', 'Bebidas', 42, 10.6, 0.0, 0.0, 0.0, [P('1 lata', 350)]],
  ['Refrigerante zero', 'Bebidas', 0, 0.0, 0.0, 0.0, 0.0, [P('1 lata', 350)]],
  ['Cerveja pilsen', 'Bebidas', 43, 3.3, 0.4, 0.0, 0.0, [P('1 lata', 350)]],
  ['Vinho tinto', 'Bebidas', 85, 2.6, 0.1, 0.0, 0.0, [P('1 taça', 150)]],
  ['Água de coco', 'Bebidas', 22, 5.3, 0.0, 0.0, 0.0, [P('1 copo', 200)]],
  ['Chá sem açúcar', 'Bebidas', 1, 0.2, 0.0, 0.0, 0.0, [P('1 xícara', 200)]],
  ['Achocolatado em pó', 'Bebidas', 400, 90.0, 4.0, 3.0, 2.0, [COLHER(15)]],

  // Industrializados e pratos
  ['Pizza de muçarela', 'Preparados', 266, 33.0, 11.0, 10.0, 2.0, [P('1 fatia', 100)]],
  ['Hambúrguer artesanal', 'Preparados', 250, 20.0, 15.0, 12.0, 1.5, [P('1 unidade', 150)]],
  ['Coxinha', 'Preparados', 290, 30.0, 10.0, 14.0, 1.5, [P('1 unidade', 80)]],
  ['Pão de queijo (unidade)', 'Preparados', 330, 34.0, 8.0, 18.0, 1.0, [P('1 unidade', 20)]],
  ['Sushi (niguiri)', 'Preparados', 150, 28.0, 5.0, 1.5, 0.5, [P('1 unidade', 30)]],
  ['Sanduíche natural de frango', 'Preparados', 210, 26.0, 12.0, 6.0, 2.0, [P('1 unidade', 130)]],
  ['Salada de frutas', 'Preparados', 60, 14.0, 0.8, 0.3, 1.8, [P('1 tigela', 200)]],
  ['Bolo de chocolate (fatia)', 'Preparados', 380, 52.0, 5.0, 17.0, 2.0, [P('1 fatia', 80)]],
  ['Brigadeiro', 'Preparados', 380, 60.0, 4.0, 14.0, 1.0, [P('1 unidade', 25)]],
  ['Barra de cereal', 'Preparados', 380, 70.0, 6.0, 8.0, 4.0, [P('1 unidade', 25)]],
  ['Chocolate ao leite', 'Preparados', 540, 58.0, 7.0, 30.0, 3.0, [P('1 quadradinho', 10), P('1 barra', 90)]],
  ['Sorvete de creme', 'Preparados', 207, 24.0, 3.5, 11.0, 0.7, [P('1 bola', 60)]],
  ['Pasta de amendoim', 'Preparados', 590, 22.0, 25.0, 50.0, 8.0, [COLHER(15)]],
  ['Castanha-do-pará', 'Preparados', 660, 12.0, 14.0, 66.0, 7.5, [P('2 unidades', 10)]],
  ['Amendoim torrado', 'Preparados', 570, 19.0, 26.0, 46.0, 8.0, [P('1 punhado', 30)]],
  ['Tapioca pronta com frango', 'Preparados', 230, 30.0, 12.0, 7.0, 1.5, [P('1 unidade', 140)]],
  ['Omelete de 2 ovos', 'Preparados', 190, 1.5, 14.0, 14.0, 0.0, [P('1 porção', 120)]],
  ['Salada Caesar com frango', 'Preparados', 180, 6.0, 14.0, 11.0, 2.0, [P('1 prato', 250)]],
  ['Sopa de legumes com frango', 'Preparados', 45, 5.0, 4.2, 1.1, 1.2, [P('1 prato fundo', 300)]],
  ['Azeite de oliva', 'Preparados', 884, 0.0, 0.0, 100.0, 0.0, [P('1 fio', 8), COLHER(13)]],
];

export const SEED_FOODS: Food[] = ROWS.map((row, index) => {
  const [name, category, kcal, carbs, protein, fat, fiber, portions] = row;
  const per100: Nutrition100 = { kcal, carbs, protein, fat, fiber };
  return {
    id: `seed-${String(index + 1).padStart(3, '0')}`,
    name,
    category,
    per100,
    portions: portions && portions.length ? portions : [{ label: '1 porção (100 g)', grams: 100 }],
    favorite: ['Arroz branco cozido', 'Feijão carioca cozido', 'Frango grelhado (peito)', 'Ovo cozido', 'Banana prata', 'Pão francês', 'Café sem açúcar'].includes(name),
  };
});

export const FOOD_CATEGORIES = ['Todos', 'Favoritos', 'Cereais', 'Frutas', 'Vegetais', 'Proteínas', 'Laticínios', 'Bebidas', 'Preparados'];
