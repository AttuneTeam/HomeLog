export type Classification =
  | "repair"
  | "capital_improvement"
  | "initial_repair";
export type ManualTaxClassification =
  | "Immediate Repair"
  | "Repair"
  | "Capital Works";
export type AiTaxClassification =
  | "Immediate Deduction"
  | "Capital Works (Div 43)"
  | "Plant & Equipment (Div 40)";
export type RenovationStatus = "planned" | "in_progress" | "completed";
export type ExpenseCategory =
  | "labour"
  | "materials"
  | "permits"
  | "professional_fees"
  | "appliances"
  | "fixtures"
  | "other";

export type PropertyFile = {
  id: string;
  property_id: string;
  storage_path: string;
  display_name: string | null;
  created_at: string;
};

export type RentalPeriod = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  weekly_rent: number;
  management_company: string | null;
  agent_name: string | null;
  management_fee_pct: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          financial_year_start_month: number;
          financial_year_start_day: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          financial_year_start_month?: number;
          financial_year_start_day?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          financial_year_start_month?: number;
          financial_year_start_day?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          user_id: string;
          address: string;
          suburb: string | null;
          state: string | null;
          postcode: string | null;
          purchase_date: string | null;
          purchase_price: number | null;
          stamp_duty: number | null;
          property_type: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          address: string;
          suburb?: string | null;
          state?: string | null;
          postcode?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          stamp_duty?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          suburb?: string | null;
          state?: string | null;
          postcode?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          stamp_duty?: number | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "properties_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      renovations: {
        Row: {
          id: string;
          property_id: string;
          name: string;
          description: string | null;
          contractor: string | null;
          start_date: string | null;
          end_date: string | null;
          status: RenovationStatus;
          classification: Classification;
          claimable: boolean | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          name: string;
          description?: string | null;
          contractor?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: RenovationStatus;
          classification: Classification;
          claimable?: boolean | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          contractor?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: RenovationStatus;
          classification?: Classification;
          claimable?: boolean | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "renovations_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      roi_calculator_inputs: {
        Row: {
          user_id: string;
          purchase_price: number | null;
          stamp_duty: number | null;
          legal_fees: number | null;
          capital_growth_rate: number | null;
          weekly_rent: number | null;
          management_fee_rate: number | null;
          council_rates: number | null;
          insurance: number | null;
          maintenance: number | null;
          loan_amount: number | null;
          interest_rate: number | null;
          loan_term: number | null;
          div43_depreciation: number | null;
          div40_depreciation: number | null;
          marginal_tax_rate: number | null;
          annual_household_income: number | null;
          updated_at: string;
          property_id: string;
        };
        Insert: {
          user_id: string;
          property_id?: string;
          purchase_price?: number | null;
          stamp_duty?: number | null;
          legal_fees?: number | null;
          capital_growth_rate?: number | null;
          weekly_rent?: number | null;
          management_fee_rate?: number | null;
          council_rates?: number | null;
          insurance?: number | null;
          maintenance?: number | null;
          loan_amount?: number | null;
          interest_rate?: number | null;
          loan_term?: number | null;
          div43_depreciation?: number | null;
          div40_depreciation?: number | null;
          marginal_tax_rate?: number | null;
          annual_household_income?: number | null;
          updated_at?: string;
        };
        Update: {
          property_id?: string;
          purchase_price?: number | null;
          stamp_duty?: number | null;
          legal_fees?: number | null;
          capital_growth_rate?: number | null;
          weekly_rent?: number | null;
          management_fee_rate?: number | null;
          council_rates?: number | null;
          insurance?: number | null;
          maintenance?: number | null;
          loan_amount?: number | null;
          interest_rate?: number | null;
          loan_term?: number | null;
          div43_depreciation?: number | null;
          div40_depreciation?: number | null;
          marginal_tax_rate?: number | null;
          annual_household_income?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roi_calculator_inputs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          renovation_id: string;
          amount: number;
          category: ExpenseCategory;
          expense_date: string;
          description: string | null;
          supplier: string | null;
          invoice_path: string | null;
          context_notes: string | null;
          manual_classification: ManualTaxClassification | null;
          raw_text: string | null;
          abn: string | null;
          gst_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          renovation_id: string;
          amount: number;
          category: ExpenseCategory;
          expense_date: string;
          description?: string | null;
          supplier?: string | null;
          invoice_path?: string | null;
          context_notes: string | null;
          manual_classification?: ManualTaxClassification | null;
          raw_text?: string | null;
          abn?: string | null;
          gst_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          category?: ExpenseCategory;
          expense_date?: string;
          description?: string | null;
          supplier?: string | null;
          invoice_path?: string | null;
          context_notes?: string | null;
          manual_classification?: ManualTaxClassification | null;
          raw_text?: string | null;
          abn?: string | null;
          gst_amount?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_renovation_id_fkey";
            columns: ["renovation_id"];
            isOneToOne: false;
            referencedRelation: "renovations";
            referencedColumns: ["id"];
          },
        ];
      };
      ato_rulings_embeddings: {
        Row: {
          id: string;
          ruling_ref: string;
          title: string;
          chunk_index: number;
          chunk_text: string;
          embedding: number[] | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          ruling_ref: string;
          title: string;
          chunk_index?: number;
          chunk_text: string;
          embedding?: number[] | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          ruling_ref?: string;
          title?: string;
          chunk_index?: number;
          chunk_text?: string;
          embedding?: number[] | null;
          metadata?: Record<string, unknown>;
        };
        Relationships: [];
      };
      expense_embeddings: {
        Row: {
          id: string;
          expense_id: string;
          chunk_index: number;
          chunk_text: string;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          chunk_index?: number;
          chunk_text: string;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: {
          chunk_index?: number;
          chunk_text?: string;
          embedding?: number[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "expense_embeddings_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
        ];
      };
      property_files: {
        Row: {
          id: string;
          property_id: string;
          storage_path: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          storage_path: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_files_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_periods: {
        Row: {
          id: string;
          property_id: string;
          start_date: string;
          end_date: string | null;
          weekly_rent: number;
          management_company: string | null;
          agent_name: string | null;
          management_fee_pct: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          start_date: string;
          end_date?: string | null;
          weekly_rent: number;
          management_company?: string | null;
          agent_name?: string | null;
          management_fee_pct?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          start_date?: string;
          end_date?: string | null;
          weekly_rent?: number;
          management_company?: string | null;
          agent_name?: string | null;
          management_fee_pct?: number | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_periods_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      renovation_quotes: {
        Row: {
          id: string;
          renovation_id: string;
          title: string;
          description: string | null;
          total_cost: number | null;
          contractor: string | null;
          file_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          renovation_id: string;
          title: string;
          description?: string | null;
          total_cost?: number | null;
          contractor?: string | null;
          file_path?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          total_cost?: number | null;
          contractor?: string | null;
          file_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "renovation_quotes_renovation_id_fkey";
            columns: ["renovation_id"];
            isOneToOne: false;
            referencedRelation: "renovations";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_ai_classifications: {
        Row: {
          id: string;
          quote_id: string;
          classification: AiTaxClassification;
          deduction_strategy: string;
          legal_citation: string;
          environmental_flag: boolean;
          confidence_score: number;
          model_used: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          classification: AiTaxClassification;
          deduction_strategy: string;
          legal_citation: string;
          environmental_flag?: boolean;
          confidence_score: number;
          model_used?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          classification?: AiTaxClassification;
          deduction_strategy?: string;
          legal_citation?: string;
          environmental_flag?: boolean;
          confidence_score?: number;
          model_used?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_ai_classifications_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: true;
            referencedRelation: "renovation_quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_ai_classifications: {
        Row: {
          id: string;
          expense_id: string;
          classification: AiTaxClassification;
          deduction_strategy: string;
          legal_citation: string;
          environmental_flag: boolean;
          confidence_score: number;
          raw_response: Record<string, unknown>;
          model_used: string;
          ato_chunks_used: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          classification: AiTaxClassification;
          deduction_strategy: string;
          legal_citation: string;
          environmental_flag?: boolean;
          confidence_score: number;
          raw_response?: Record<string, unknown>;
          model_used?: string;
          ato_chunks_used?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          classification?: AiTaxClassification;
          deduction_strategy?: string;
          legal_citation?: string;
          environmental_flag?: boolean;
          confidence_score?: number;
          raw_response?: Record<string, unknown>;
          model_used?: string;
          ato_chunks_used?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_ai_classifications_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: true;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_ato_rulings: {
        Args: {
          query_embedding: number[];
          match_count?: number;
          match_threshold?: number;
        };
        Returns: {
          id: string;
          ruling_ref: string;
          title: string;
          chunk_text: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      classification: Classification;
      renovation_status: RenovationStatus;
      expense_category: ExpenseCategory;
      ai_tax_classification: AiTaxClassification;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
