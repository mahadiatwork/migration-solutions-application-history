import { useState, useEffect } from "react";

import { zohoApi } from "../zohoApi";

export const useZohoInit = ({ height, width } = {}) => {
  const [initZoho, setInitZoho] = useState(false);
  const [module, setModule] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    zohoApi.auth.initZoho(
      (data, error) => {
        const { Entity, EntityId } = data;
        console.log("entity", Entity);
        console.log("EntityId", EntityId)
        setModule(Entity);
        setRecordId(EntityId);
        setInitialData(data);
      },
      { height, width },
      (initZoho) => {
        setInitZoho(initZoho);
      }
    );
  }, [height, width]);

  return {
    initZoho,
    module,
    recordId,
    initialData,
  };
};
