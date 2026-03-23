import { Notyf } from 'notyf';
import 'notyf/notyf.min.css';

// Create an instance of Notyf
export const notyf = new Notyf({
  duration: 4000,
  position: {
    x: 'right',
    y: 'bottom',
  },
  types: [
    {
      type: 'warning',
      background: 'orange',
      icon: false,
    },
    {
      type: 'info',
      background: '#3B82F6',
      icon: false,
    }
  ]
});
