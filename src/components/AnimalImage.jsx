import { useState } from "react";

// Shows the given photo. If there's no photo (empty `images` list, or
// the file fails to load), it shows a placeholder sketch instead, so
// the quiz still works with no photos at all.
export default function AnimalImage({ species, src }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="placeholder">
        <span className="placeholder-label">Foto mangler — {species.name_da}</span>
        <span className="placeholder-hint">
          add a photo for "{species.id}" in species.js
        </span>
      </div>
    );
  }

  // The backdrop is a blurred copy of the photo, only shown on desktop
  // (see Retro.css), where the whole photo is fitted into a wide frame.
  return (
    <>
      <div className="image-backdrop" style={{ backgroundImage: `url("${src}")` }} aria-hidden="true" />
      <img
        className="image"
        src={src}
        alt={species.name_da}
        onError={() => setFailed(true)}
      />
    </>
  );
}
