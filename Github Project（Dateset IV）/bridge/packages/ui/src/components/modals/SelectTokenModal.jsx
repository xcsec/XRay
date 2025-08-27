import { TokenSelectorModal } from "components/modals/TokenSelectorModal";
import React, { useState } from "react";

export const SelectTokenModal = ({ isOpen, onClose }) => {
  const [custom, setCustom] = useState(false);

  return (
    <>
      {!custom && (
        <TokenSelectorModal
          isOpen={isOpen}
          onClose={onClose}
          onCustom={() => setCustom(true)}
        />
      )}
    </>
  );
};
