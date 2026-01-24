import React, { useEffect, useState } from 'react';
import { X, Trash2, Calendar, PackageOpen, ChevronRight, Search, ArchiveX } from 'lucide-react';
import { InventoryItem } from '../types';
import { getInventory, deleteFromInventory, clearInventory } from '../services/historyservice';

interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadItem: (item: InventoryItem) => void;
}

const InventoryDrawer: React.FC<InventoryDrawerProps> = ({ isOpen, onClose, onLoadItem }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const loadItems = () => {
    setItems(getInventory());
  };

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      loadItems();
      setSearchQuery('');
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 50);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteFromInventory(id);
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAll = () => {
    if (items.length === 0) return;
    if (window.confirm("Are you sure you want to delete all items from your inventory? This cannot be undone.")) {
      clearInventory();
      setItems([]);
    }
  };

  const filteredItems = items.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      item.productData.title.toLowerCase().includes(query) ||
      item.productData.category?.toLowerCase().includes(query) ||
      item.productData.description?.toLowerCase().includes(query)
    );
  });

  if (!shouldRender) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes inventoryDrawerSlideIn {
          0% {
            transform: translateX(100%) rotateY(-15deg);
            opacity: 0;
          }
          60% {
            transform: translateX(-10px) rotateY(0deg);
          }
          100% {
            transform: translateX(0) rotateY(0deg);
            opacity: 1;
          }
        }

        @keyframes inventoryDrawerSlideOut {
          0% {
            transform: translateX(0) scale(1) rotateY(0deg) rotateZ(0deg);
            opacity: 1;
            filter: blur(0px) brightness(1) saturate(1);
            clip-path: inset(0 0 0 0 round 0px);
          }
          15% {
            transform: translateX(8px) scale(1.02) rotateY(-3deg) rotateZ(1deg);
            opacity: 1;
            filter: blur(0px) brightness(1.1) saturate(1.2);
          }
          30% {
            transform: translateX(20px) scale(0.98) rotateY(8deg) rotateZ(-3deg);
            opacity: 0.95;
            filter: blur(1px) brightness(1.05) saturate(1.1);
            clip-path: inset(0 0 0 0 round 8px);
          }
          50% {
            transform: translateX(60px) scale(0.85) rotateY(20deg) rotateZ(5deg);
            opacity: 0.7;
            filter: blur(4px) brightness(0.95) saturate(0.8) hue-rotate(15deg);
            clip-path: inset(2% 5% 2% 0 round 16px);
          }
          70% {
            transform: translateX(110%) scale(0.6) rotateY(45deg) rotateZ(15deg);
            opacity: 0.4;
            filter: blur(10px) brightness(0.7) saturate(0.5) hue-rotate(30deg);
            clip-path: inset(5% 10% 5% 0 round 24px);
          }
          85% {
            transform: translateX(130%) scale(0.35) rotateY(70deg) rotateZ(25deg);
            opacity: 0.15;
            filter: blur(20px) brightness(0.4) saturate(0.2) hue-rotate(45deg);
            clip-path: inset(15% 20% 15% 0 round 32px);
          }
          100% {
            transform: translateX(150%) scale(0.1) rotateY(90deg) rotateZ(35deg);
            opacity: 0;
            filter: blur(30px) brightness(0) saturate(0) hue-rotate(60deg);
            clip-path: inset(30% 40% 30% 0 round 50px);
          }
        }

        @keyframes inventoryBackdropFadeIn {
          0% { opacity: 0; backdrop-filter: blur(0px); }
          100% { opacity: 1; backdrop-filter: blur(4px); }
        }

        @keyframes inventoryBackdropFadeOut {
          0% {
            opacity: 1;
            backdrop-filter: blur(4px);
            background: rgba(0, 0, 0, 0.2);
          }
          50% {
            backdrop-filter: blur(8px);
            background: rgba(0, 0, 0, 0.1);
          }
          100% {
            opacity: 0;
            backdrop-filter: blur(0px);
            background: rgba(0, 0, 0, 0);
          }
        }

        .inventory-drawer-backdrop-enter {
          animation: inventoryBackdropFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .inventory-drawer-backdrop-exit {
          animation: inventoryBackdropFadeOut 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .inventory-drawer-enter {
          animation: inventoryDrawerSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .inventory-drawer-exit {
          animation: inventoryDrawerSlideOut 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
          transform-origin: center right;
        }
      `}} />

      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 ${
          !isClosing ? 'inventory-drawer-backdrop-enter' : 'inventory-drawer-backdrop-exit'
        } ${isClosing ? 'pointer-events-none' : ''}`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col ${
          !isClosing ? 'inventory-drawer-enter' : 'inventory-drawer-exit'
        }`}
        style={{ perspective: '1000px' }}
      >
        
        {/* Header Section */}
        <div className="bg-white border-b border-gray-100 z-10 shadow-sm">
          <div className="p-5 pb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                 <PackageOpen size={20} />
              </div>
              My Inventory
            </h2>
            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <button 
                  onClick={handleClearAll}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  title="Clear All"
                >
                  <ArchiveX size={20} />
                </button>
              )}
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                <X size={20} />
              </button>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="px-5 pb-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search products..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-6 space-y-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <PackageOpen size={32} className="opacity-40" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Your inventory is empty</p>
                <p className="text-sm mt-1 opacity-70">Save analyzed products to build your catalog.</p>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-6">
              <Search size={32} className="opacity-30 mb-3" />
              <p className="text-sm">No items found matching "{searchQuery}"</p>
            </div>
          ) : (
            filteredItems.map(item => (
              <div 
                key={item.id}
                onClick={() => onLoadItem(item)}
                className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex gap-3 relative overflow-hidden"
              >
                <div className="w-20 h-20 shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                  <img 
                    src={`data:${item.mimeType};base64,${item.imageData}`} 
                    alt={item.productData.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <h3 className="font-semibold text-gray-900 truncate text-sm mb-1 leading-tight group-hover:text-indigo-600 transition-colors">
                      {item.productData.title}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Calendar size={12} />
                      {new Date(item.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                     <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                       {item.productData.priceEstimate || 'N/A'}
                     </span>
                  </div>
                </div>

                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-sm border border-gray-100">
                  <button 
                       onClick={(e) => handleDelete(e, item.id)}
                       className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                       title="Delete"
                     >
                       <Trash2 size={14} />
                  </button>
                  <div className="w-px bg-gray-200 my-1"></div>
                  <div className="p-1.5 text-indigo-600">
                    <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default InventoryDrawer;