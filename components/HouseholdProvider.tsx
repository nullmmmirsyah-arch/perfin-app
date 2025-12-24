'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface HouseholdContextType {
  householdId: Id<"households"> | null;
  households: any[];
  selectHousehold: (id: Id<"households">) => void;
  isLoading: boolean;
  createHousehold: (name: string) => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const households = useQuery(api.households.list);
  const getOrCreateDefault = useMutation(api.households.getOrCreateDefault);
  const createHouseholdMutation = useMutation(api.households.create);
  
  const [householdId, setHouseholdId] = useState<Id<"households"> | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function init() {
      if (households === undefined) return; // Loading

      if (households.length === 0) {
        // Create default
        try {
            // We only try to create if we are authenticated. 
            // If households is empty array, it means we are auth'd but have no households.
            const newId = await getOrCreateDefault();
            setHouseholdId(newId);
        } catch (e) {
            // Might be unauthenticated or error
            console.error("Failed to create default household", e);
        }
      } else {
        // We have households. Check if current one is valid
        const saved = localStorage.getItem("selectedHouseholdId");
        const found = households.find(h => h._id === saved);
        
        if (found) {
            setHouseholdId(found._id);
        } else {
            // Default to first
            setHouseholdId(households[0]._id);
            localStorage.setItem("selectedHouseholdId", households[0]._id);
        }
      }
      setIsInitializing(false);
    }

    init();
  }, [households, getOrCreateDefault]);

  const selectHousehold = (id: Id<"households">) => {
    setHouseholdId(id);
    localStorage.setItem("selectedHouseholdId", id);
  };

  const createHousehold = async (name: string) => {
      const newId = await createHouseholdMutation({ name });
      selectHousehold(newId);
  }

  return (
    <HouseholdContext.Provider value={{ 
        householdId, 
        households: households || [], 
        selectHousehold, 
        isLoading: isInitializing || households === undefined,
        createHousehold
    }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error("useHousehold must be used within a HouseholdProvider");
  }
  return context;
}
