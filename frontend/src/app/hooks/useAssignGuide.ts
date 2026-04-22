import { useState } from "react";
import { mockApi } from "../mock/api";
import type { AssignGuideToServiceRequest, AssignGuideToServiceResponse } from "../mock/types";

const getErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return "Unable to assign guide to service.";
  }

  try {
    const parsed = JSON.parse(error.message) as { detail?: string; title?: string };
    return parsed.detail || parsed.title || error.message;
  } catch {
    return error.message;
  }
};

export function useAssignGuide() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AssignGuideToServiceResponse | null>(null);

  const assignGuide = async (payload: AssignGuideToServiceRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await mockApi.assignGuideToService(payload);
      setData(result);
      return result;
    } catch (error) {
      const message = getErrorMessage(error);
      setError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    setData(null);
  };

  return {
    assignGuide,
    data,
    error,
    isLoading,
    reset,
  };
}
