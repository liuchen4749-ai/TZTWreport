import L from 'leaflet';

export const createCustomIcon = (color: string, isActive: boolean = false) => {
  const scale = isActive ? 1.2 : 1; 
  const borderColor = isActive ? '#00FF00' : 'white';
  const shadow = isActive ? '0 0 10px yellow' : '0 0 5px black';
  
  // Size 22px
  return L.divIcon({
    className: `custom-icon ${isActive ? 'active-marker' : ''}`,
    html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:2px solid ${borderColor};box-shadow:${shadow};transform:scale(${scale});"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};