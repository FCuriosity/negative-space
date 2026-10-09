import { useId } from 'react';

const distant='M-20 300C12 296 34 281 55 279S86 284 109 269C126 258 138 263 154 253S178 247 190 239C202 231 214 237 225 244S244 252 256 261C281 279 301 265 329 274S368 292 401 278C420 270 438 268 453 258S474 254 493 267C516 283 531 275 549 280S582 292 609 278C633 267 648 269 667 254S692 253 711 267C738 283 754 279 775 285S809 278 830 263C844 254 856 259 871 253S894 260 910 271C929 286 953 279 980 288V352H-20Z';
const middle='M-20 318C12 305 33 311 54 302S80 304 103 298C129 291 143 299 161 294S186 279 204 277C222 275 232 264 246 265S266 281 282 281C306 281 322 299 344 303S375 296 401 304C432 313 448 298 472 293S498 291 515 284C532 278 543 285 558 286S584 303 606 305C630 307 651 293 671 286S694 267 710 269C725 270 734 283 749 288S772 292 793 302C820 315 836 299 861 303S898 293 920 300C942 307 958 298 980 300V354H-20Z';
const near='M-20 327C18 320 40 324 67 318S100 313 129 319C159 326 182 315 209 313S246 308 278 316C304 323 330 317 357 319S397 326 430 320C460 314 478 315 504 309S536 310 563 319C589 327 619 317 644 321S680 315 707 309C734 303 753 308 777 314S815 319 844 317C877 313 902 320 927 316S960 318 980 322V355H-20Z';

/** Curved ridges, shaded folds and valley haze keep the distant terrain organic. */
export function MirrorLakeMountains() {
  const id=useId().replace(/:/g,'');
  return <g aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-far`} x1="0" y1="0" x2=".3" y2="1"><stop stopColor="#817085"/><stop offset="1" stopColor="#51546f"/></linearGradient>
      <linearGradient id={`${id}-mid`} x1="0" y1="0" x2=".25" y2="1"><stop stopColor="#575773"/><stop offset="1" stopColor="#303c57"/></linearGradient>
      <linearGradient id={`${id}-fold`} x1="0" y1="0" x2="1" y2=".6"><stop stopColor="#cda5a1" stopOpacity=".19"/><stop offset="1" stopColor="#1d2c48" stopOpacity=".02"/></linearGradient>
      <clipPath id={`${id}-far-clip`}><path d={distant}/></clipPath>
      <clipPath id={`${id}-mid-clip`}><path d={middle}/></clipPath>
      <filter id={`${id}-mist`} x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <path d={distant} fill={`url(#${id}-far)`} opacity=".84"/>
    <g clipPath={`url(#${id}-far-clip)`}>
      <path d="M198 235C197 253 173 264 182 278S166 301 141 325H243C222 309 226 292 213 278S215 250 198 235ZM466 251C450 272 458 282 432 296S422 327 421 348H490C487 321 476 306 479 288S468 263 466 251ZM685 249C669 264 678 277 657 295S645 321 620 344H724C708 315 698 308 700 286S685 264 685 249ZM871 251C861 270 842 280 847 299S831 329 816 341H925C906 320 894 296 891 286S874 264 871 251Z" fill={`url(#${id}-fold)`}/>
      <path d="M202 242Q218 261 232 266T259 286M466 260Q478 282 491 287M685 258Q698 275 713 280M863 263Q851 281 829 289" fill="none" stroke="#c7a5a0" strokeWidth=".8" opacity=".18"/>
    </g>
    <path d="M-15 303Q122 279 247 297T505 301T747 292T975 298" fill="none" stroke="#b49baf" strokeWidth="10" opacity=".17" filter={`url(#${id}-mist)`}/>
    <path d={middle} fill={`url(#${id}-mid)`}/>
    <g clipPath={`url(#${id}-mid-clip)`} fill="#1f304a" opacity=".25">
      <path d="M247 265C257 285 244 289 240 307S211 338 203 353H303C270 331 278 317 267 302S252 278 247 265ZM530 281C513 300 524 314 493 347H576C551 322 548 316 545 301S533 288 530 281ZM710 268C706 289 690 297 695 315S666 341 650 354H771C741 328 729 306 725 293S715 278 710 268Z"/>
    </g>
    <path d="M0 324Q180 302 360 321T698 318T960 316" fill="none" stroke="#9a9bac" strokeWidth="7" opacity=".13" filter={`url(#${id}-mist)`}/>
    <path d={near} fill="#25324b"/>
  </g>;
}
