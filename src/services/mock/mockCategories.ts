import {
  IngredientCategory,
  RecipeCategory,
  ShoppingCategory,
} from '../../shared/types/domain';

export const MOCK_INGREDIENT_CATEGORIES: IngredientCategory[] = [
  { id: 'ing_cat_protein', name: 'پروتئین و گوشت', color: '#c83e3b', icon: 'Beef', order: 1, isActive: true },
  { id: 'ing_cat_dairy', name: 'لبنیات و تخم‌مرغ', color: '#3d6f8e', icon: 'Milk', order: 2, isActive: true },
  { id: 'ing_cat_grains', name: 'غلات و نان', color: '#c27803', icon: 'Wheat', order: 3, isActive: true },
  { id: 'ing_cat_legumes', name: 'حبوبات', color: '#8d5b4c', icon: 'Bean', order: 4, isActive: true },
  { id: 'ing_cat_veg', name: 'سبزیجات', color: '#2f6f4e', icon: 'Leaf', order: 5, isActive: true },
  { id: 'ing_cat_nuts', name: 'مغزها و خشکبار', color: '#9c6644', icon: 'Nut', order: 6, isActive: true },
  { id: 'ing_cat_oil', name: 'روغن و چاشنی', color: '#b08968', icon: 'Droplets', order: 7, isActive: true },
  { id: 'ing_cat_fruit', name: 'میوه و شیرین‌کننده', color: '#d97706', icon: 'Apple', order: 8, isActive: true },
];

export const MOCK_RECIPE_CATEGORIES: RecipeCategory[] = [
  { id: 'rec_cat_breakfast', name: 'صبحانه', description: 'وعده‌های مغذی شروع روز', color: '#d97706', icon: 'Sun', order: 1, isActive: true },
  { id: 'rec_cat_main', name: 'غذای اصلی', description: 'غذاهای سنتی و مدرن ناهار و شام', color: '#2f6f4e', icon: 'Utensils', order: 2, isActive: true },
  { id: 'rec_cat_salad', name: 'سالاد', description: 'سالادهای کامل و پروتئینی', color: '#16a34a', icon: 'Salad', order: 3, isActive: true },
  { id: 'rec_cat_soup', name: 'سوپ و آش', description: 'پیش‌غذا و وعده‌های سبک گرم', color: '#c27803', icon: 'Soup', order: 4, isActive: true },
  { id: 'rec_cat_snack', name: 'میان‌وعده', description: 'اسنک‌های سالم خانگی', color: '#3d6f8e', icon: 'Coffee', order: 5, isActive: true },
  { id: 'rec_cat_dessert', name: 'دسر سالم', description: 'دسرهای کم‌شکر و خانگی', color: '#9c6644', icon: 'Cookie', order: 6, isActive: true },
  { id: 'rec_cat_drink', name: 'نوشیدنی', description: 'اسموتی و نوشیدنی‌های طبیعی', color: '#4b9b70', icon: 'CupSoda', order: 7, isActive: true },
];

export const MOCK_SHOPPING_CATEGORIES: ShoppingCategory[] = [
  { id: 'shop_cat_produce', title: 'میوه و سبزیجات', color: '#2f6f4e', icon: 'Carrot', order: 1, isActive: true },
  { id: 'shop_cat_dairy', title: 'لبنیات', color: '#3d6f8e', icon: 'Milk', order: 2, isActive: true },
  { id: 'shop_cat_protein', title: 'گوشت و پروتئین', color: '#c83e3b', icon: 'Beef', order: 3, isActive: true },
  { id: 'shop_cat_grains', title: 'غلات و نان', color: '#c27803', icon: 'Wheat', order: 4, isActive: true },
  { id: 'shop_cat_legumes', title: 'حبوبات', color: '#8d5b4c', icon: 'Bean', order: 5, isActive: true },
  { id: 'shop_cat_spices', title: 'ادویه و چاشنی', color: '#b08968', icon: 'Sparkles', order: 6, isActive: true },
  { id: 'shop_cat_supplements', title: 'مکمل‌ها', color: '#4b9b70', icon: 'Pill', order: 7, isActive: true },
  { id: 'shop_cat_other', title: 'سایر موارد', color: '#6b7280', icon: 'Package', order: 8, isActive: true },
];
