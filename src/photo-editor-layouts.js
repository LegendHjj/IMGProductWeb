import { makePhotoText } from './photo-editor-model.js';

// Original, editable type pairings. Sizes and offsets are relative to the photo's short side.
const line = (text, font, size, y, extra = {}) => ({ text, font, size, y, ...extra });
export const TEXT_LAYOUTS = [
  { id: 'arrival', name: 'New arrival', category: 'Product', lines: [line('N E W  A R R I V A L', 'Arial', .026, -.14), line('Everyday essentials', 'Playfair Display', .065, -.025), line('Thoughtfully made. Beautifully yours.', 'Arial', .025, .09)] },
  { id: 'sale', name: 'Big sale', category: 'Product', lines: [line('LIMITED TIME ONLY', 'Arial', .027, -.16), line('SALE', 'Bebas Neue', .2, -.025, { color: '#ef493d', outline: true, outlineColor: '#ffffff' }), line('UP TO 50% OFF', 'Arial', .048, .135, { background: true, color: '#ffffff' })] },
  { id: 'luxury', name: 'Signature collection', category: 'Product', lines: [line('Signature', 'Playfair Display', .11, -.04, { color: '#ecd6a0' }), line('P R E M I U M  C O L L E C T I O N', 'Arial', .023, .075, { color: '#ecd6a0' })] },
  { id: 'price', name: 'Price spotlight', category: 'Product', lines: [line('Y O U R  N E W  F A V O U R I T E', 'Arial', .022, -.13), line('RM 49', 'Bebas Neue', .17, 0), line('SPECIAL INTRODUCTORY PRICE', 'Arial', .026, .125)] },
  { id: 'bestseller', name: 'Bestseller', category: 'Product', lines: [line('THE ORIGINAL', 'Arial', .028, -.125), line('Best Seller', 'Playfair Display', .1, 0), line('Loved by you. Made for every day.', 'Arial', .026, .11)] },
  { id: 'studio', name: 'Modern brand', category: 'Product', lines: [line('S T U D I O', 'Arial', .09, -.035), line('THE EVERYDAY COLLECTION', 'Arial', .029, .065)] },
  { id: 'features', name: 'Product details', category: 'Product', lines: [line('Made for you', 'Playfair Display', .095, -.1), line('SOFT TOUCH  ·  PREMIUM QUALITY', 'Arial', .026, .025), line('Beautiful details, effortless comfort.', 'Arial', .025, .105)] },
  { id: 'launch', name: 'Launch announcement', category: 'Product', lines: [line('INTRODUCING', 'Arial', .03, -.14), line('The New Collection', 'Playfair Display', .08, -.025), line('AVAILABLE NOW', 'Arial', .035, .115, { background: true, color: '#ffffff' })] },
  { id: 'thanks', name: 'Thank you', category: 'Greetings', lines: [line('Thank you!', 'Dancing Script', .16, -.035, { color: '#197d86' }), line('FOR SUPPORTING OUR SMALL BUSINESS', 'Arial', .023, .1)] },
  { id: 'handmade', name: 'Made with love', category: 'Greetings', lines: [line('Handmade', 'Dancing Script', .14, -.045), line('W I T H  L O V E', 'Arial', .032, .08)] },
  { id: 'quote', name: 'Editorial quote', category: 'Editorial', lines: [line('“Find beauty in\nthe little things.”', 'Playfair Display', .075, -.035), line('— YOUR DAILY INSPIRATION —', 'Arial', .023, .12)] },
  { id: 'poster', name: 'Retro poster', category: 'Editorial', lines: [line('ANNUAL', 'Arial', .025, -.18), line('CRAFT\nMARKET', 'Bebas Neue', .12, -.015), line('SATURDAY  ·  10 AM – 6 PM', 'Arial', .027, .17)] },
  { id: 'dinner', name: 'Elegant invitation', category: 'Editorial', lines: [line('You are invited', 'Dancing Script', .07, -.18), line('DINNER\nPARTY', 'Playfair Display', .105, -.015), line('AN EVENING TO REMEMBER', 'Arial', .022, .16)] },
  { id: 'date', name: 'Save the date', category: 'Greetings', lines: [line('Together with love', 'Dancing Script', .055, -.13), line('SAVE THE DATE', 'Bebas Neue', .105, -.015), line('SEPTEMBER 26', 'Arial', .03, .1)] }
];

export function makeTextLayout(id, viewport, newId) {
  const layout = TEXT_LAYOUTS.find(item => item.id === id);
  if (!layout) return [];
  const groupId = newId();
  const unit = Math.min(viewport.width, viewport.height);
  return layout.lines.map(spec => ({
    ...makePhotoText(newId(), viewport.width, viewport.height),
    shadow: false, color: '#172033', weight: spec.font === 'Bebas Neue' ? '400' : '700',
    ...spec, groupId,
    x: viewport.x + viewport.width / 2,
    y: viewport.y + viewport.height / 2 + spec.y * unit,
    size: Math.max(1, spec.size * unit)
  }));
}
