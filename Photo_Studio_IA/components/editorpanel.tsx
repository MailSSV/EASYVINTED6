// src/components/photostudio/EditorPanel.tsx
import React, { useState } from "react";
import {
  Wand2,
  RotateCcw,
  Download,
  Sparkles,
  Undo2,
  Redo2,
  Palette,
  Store,
  Shirt,
  User,
} from "lucide-react";

interface EditorPanelProps {
  onEdit: (prompt: string) => void;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  loading: boolean;
  hasEditedImage: boolean;
  onDownload: () => void;
}

const SMART_BACKGROUND_PROMPT = `
Analyze the garment (color, material, style) and how it is presented (on hanger, flatlay, etc.), then replace the background with a realistic home setting.

Rules:
1. Use ONLY real domestic surfaces: bedspread, wooden table, chair, plain wall, door, floor.
2. Match background choice to garment color and material to keep good contrast, without studio aesthetics.
3. Light must feel natural and ambient (as in a real room), never artificial or professional.
4. Keep background simple, slightly imperfect, with subtle texture if needed.
5. Preserve the garment perfectly: shape, proportions, colors, labels, logos.

Conflict resolution priority:
1. Presentation type (hanger vs flatlay)
2. Garment type (dress, top, pants, shoes)
3. Color contrast
4. Material

Default:
If unsure, use a neutral home background (plain wall or bedspread), NOT a studio white background.

Goal:
Ordinary seller photo, natural and believable, NOT e-commerce or editorial.
`;

const ACTION_PROMPTS = {
  PLACE: `Action: Place. Place the product in the most appropriate setting, surface, or environment (hanger, clothing rack, wooden table, clean bedspread, minimalist boutique shelf, neutral interior) to showcase it in the most flattering and realistic way. Identify the garment type, style, color. Select a background that enhances it. Keep style realistic, clean, natural. Add soft consistent shadows. Strictly preserve the product details (logos, text, shapes).`,
  FOLD: `Action: Fold. Fold the garment naturally according to standard retail presentation and place it on the most appropriate support (wooden table, white matte board, linen fabric, shelf, bedspread). Maintain perfect realism, correct lighting, natural shadows. The folded shape must remain true to the garment’s real proportions. Strictly preserve the product details (logos, text, shapes).`,
  TRY_ON: `Action: Real-Life Try-On. Display the garment worn or held by a realistic human model, in a natural, everyday context (street, neutral interior). Determine correct model type. Keep model realistic, neutral. Integrate garment with perfect physical accuracy (fit, drape, fabric behavior). NO distortion. Strictly preserve the product details.`,
};

const EditorPanel: React.FC<EditorPanelProps> = ({
  onEdit,
  onReset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  loading,
  hasEditedImage,
  onDownload,
}) => {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onEdit(prompt);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto">
      <div className="bg-indigo-50/50 rounded-xl p-6 border border-indigo-100 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Wand2 className="text-indigo-600" size={20} />
            AI Magic Editor
          </h3>

          {/* History Controls */}
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded-md transition-all ${
                canUndo
                  ? "text-gray-700 hover:bg-gray-100"
                  : "text-gray-300 cursor-not-allowed"
              }`}
              title="Undo"
            >
              <Undo2 size={16} />
            </button>
            <div className="w-px h-4 bg-gray-200 mx-0.5"></div>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded-md transition-all ${
                canRedo
                  ? "text-gray-700 hover:bg-gray-100"
                  : "text-gray-300 cursor-not-allowed"
              }`}
              title="Redo"
            >
              <Redo2 size={16} />
            </button>
          </div>
        </div>

        {/* Smart Actions Grid - 4 buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {/* 1. Smart Background Button */}
          <button
            onClick={() => onEdit(SMART_BACKGROUND_PROMPT)}
            disabled={loading}
            className="flex flex-col items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md group"
          >
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform duration-200">
              <Palette size={20} />
            </div>
            <span className="text-xs font-semibold text-gray-700 text-center">
