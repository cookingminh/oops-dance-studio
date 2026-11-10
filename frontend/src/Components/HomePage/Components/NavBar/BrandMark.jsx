import logoMark from '@/assets/images/logo-mark.webp';

// The red "OOPS" square (cropped out of logo-mark.webp, which has margins and a caption) next to
// the studio name, so it stays legible on light bars and over the dark home video alike.
const BrandMark = ({ className = '' }) => (
    <span className={`pubBrand ${className}`}>
        <span className="pubBrandMark" aria-hidden="true">
            <img src={logoMark} alt="" />
        </span>
        <span className="pubBrandName">
            <strong>Oops!</strong>
            <small>Dance Studio</small>
        </span>
    </span>
);

export default BrandMark;
