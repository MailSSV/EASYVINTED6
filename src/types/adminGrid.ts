export interface AdminArticleRow {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  brand: string | null;
  size: string | null;
  condition: string | null;
  color: string | null;
  material: string | null;
  season: string | null;
  seller_id: string | null;
  price: number | null;
  net_profit: number | null;
  scheduled_for: string | null;
  sold_at: string | null;
  status: string;
  sold_price: number | null;
  photos: string[] | null;
  reference_number: string | null;
  vinted_url: string | null;
}

export interface AdminLotRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category_id: number | null;
  season: string | null;
  seller_id: string | null;
  price: number;
  original_total_price: number;
  discount_percentage: number;
  net_profit: number | null;
  scheduled_for: string | null;
  sold_at: string | null;
  status: string;
  sold_price: number | null;
  photos: string[];
  cover_photo: string | null;
  reference_number: string | null;
  vinted_url: string | null;
  article_count?: number;
}

export interface FamilyMember {
  id: string;
  name: string;
}

export interface EditState {
  rowId: string;
  field: keyof AdminArticleRow;
  originalValue: any;
  isDirty: boolean;
  isSaving: boolean;
}

export interface LotEditState {
  rowId: string;
  field: keyof AdminLotRow;
  originalValue: any;
  isDirty: boolean;
  isSaving: boolean;
}
