declare module "@/components/Aurora" {
  interface AuroraProps {
    colorStops?: string[];
    amplitude?: number;
    blend?: number;
    speed?: number;
  }
  const Aurora: React.FC<AuroraProps>;
  export default Aurora;
}
