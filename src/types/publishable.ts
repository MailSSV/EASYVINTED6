export type PublishableItemType = 'article' | 'lot';

export interface PublishableArticle {
  type: 'article';
  id: string;
  title: string;
  description: string;
  brand: string;
  size: string;
  condition: string;
  color: string;
  material: string;
  price: number;
  photos: string[];
  vinted_url: string;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  reference_number: string | null;
  seo_keywords: string[] | null;
  hashtags: string[] | null;
  search_terms: string[] | null;
}

export interface PublishableLot {
  type: 'lot';
  id: string;
  name: string;
  description: string;
  category_id: number;
  season: string;
  price: number;
  original_total_price: number;
  discount_percentage: number;
  cover_photo: string;
  photos: string[];
  vinted_url: string;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  reference_number: string | null;
  seo_keywords: string[] | null;
  hashtags: string[] | null;
  search_terms: string[] | null;
}

export type PublishableItem = PublishableArticle | PublishableLot;

export interface EasyVintedReadyArticle {
  id: string;
  title: string;
  description: string;
  categoryPath: string;
  brand: string;
  size: string;
  condition: string;
  color: string;
  material: string;
  price: number;
  photoUrls: string[];
  status: 'ready';
}

export interface EasyVintedReadyLot {
  id: string;
  title: string;
  description: string;
  categoryId: number;
  season: string;
  price: number;
  originalTotalPrice: number;
  discountPercentage: number;
  photoUrls: string[];
  status: 'ready';
}

export type EasyVintedReadyItem = EasyVintedReadyArticle | EasyVintedReadyLot;
