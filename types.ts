export type Role = 'admin' | 'editor' | 'guest';

export interface User {
  id: string;
  username: string;
  password?: string; // In a real app, never store plain text. This is for the mock DB.
  role: Role;
  name: string;
}

export interface ImageItem {
  src: string;
  caption: string;
  audios?: string[]; // base64 encoded audio
}

export interface Attachment {
  name: string;
  url: string; // base64
  size: number;
}

export interface CustomSection {
  id: string;
  title: string;
  content: string;
  images?: ImageItem[]; 
}

export interface ProjectTypeDef {
    key: string;
    label: string;
    color: string; // Hex color for icon
    bgColorClass: string; // Tailwind class for badges (simplified for dynamic: we might store hex for bg too or just use generic)
}

export interface Project {
  id: string;
  name: string;
  city: string;
  type: string; // Changed from union to string to allow dynamic types
  label: string; // Project Attribute / Tag
  lat: number;
  lng: number;
  
  // Visibility
  isHidden: boolean; // If true, guests cannot see this on map

  // Public Section
  publicDescription: string; // Description text above public images
  images: ImageItem[]; // Public images

  // Internal Section (Admin & Creator only)
  internalDescription?: string;
  internalImages?: ImageItem[];
  attachments?: Attachment[];

  customSections?: CustomSection[]; // Deprecated
  createdBy: string; // User ID
  createdByName?: string; // Display name of creator
}

export interface CityGroup {
  city: string;
  projects: Project[];
}