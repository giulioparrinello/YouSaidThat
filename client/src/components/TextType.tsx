import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";

interface TextTypeProps {
  text: string | string[];
  as?: React.ElementType;
  typingSpeed?: number;
  initialDelay?: number;
  pauseDuration?: number;
  deletingSpeed?: number;
  loop?: boolean;
  className?: string;
  showCursor?: boolean;
  hideCursorWhileTyping?: boolean;
  cursorCharacter?: string | React.ReactNode;
  cursorBlinkDuration?: number;
  cursorClassName?: string;
  textColors?: string[];
  variableSpeed?: { min: number; max: number };
  onSentenceComplete?: (sentence: string, index: number) => void;
  startOnVisible?: boolean;
  reverseMode?: boolean;
}

export default function TextType({
  text,
  as: Component = "div",
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = "",
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = "|",
  cursorBlinkDuration = 0.5,
  cursorClassName = "",
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
}: TextTypeProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(!startOnVisible);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const textArray = Array.isArray(text) ? text : [text];

  useEffect(() => {
    if (!startOnVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [startOnVisible]);

  useEffect(() => {
    if (!isVisible || isPaused) return;

    const currentFullText = textArray[currentIndex];
    
    const handleTyping = () => {
      if (!isDeleting) {
        if (displayedText.length < currentFullText.length) {
          const nextChar = currentFullText[displayedText.length];
          setDisplayedText((prev) => prev + nextChar);
          
          const speed = variableSpeed 
            ? Math.floor(Math.random() * (variableSpeed.max - variableSpeed.min + 1)) + variableSpeed.min
            : typingSpeed;
            
          typingTimeout.current = setTimeout(handleTyping, speed);
        } else {
          setIsPaused(true);
          if (onSentenceComplete) onSentenceComplete(currentFullText, currentIndex);
          
          typingTimeout.current = setTimeout(() => {
            setIsPaused(false);
            setIsDeleting(true);
          }, pauseDuration);
        }
      } else {
        if (displayedText.length > 0) {
          setDisplayedText((prev) => prev.slice(0, -1));
          typingTimeout.current = setTimeout(handleTyping, deletingSpeed);
        } else {
          setIsDeleting(false);
          const nextIndex = (currentIndex + 1) % textArray.length;
          if (!loop && nextIndex === 0) return;
          setCurrentIndex(nextIndex);
        }
      }
    };

    typingTimeout.current = setTimeout(handleTyping, displayedText.length === 0 ? initialDelay : 0);

    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [
    displayedText,
    isDeleting,
    currentIndex,
    isVisible,
    isPaused,
    textArray,
    typingSpeed,
    initialDelay,
    pauseDuration,
    deletingSpeed,
    loop,
    variableSpeed,
    onSentenceComplete,
  ]);

  const currentColor = textColors[currentIndex] || "inherit";
  const shouldShowCursor = showCursor && (!hideCursorWhileTyping || isPaused);

  return (
    <Component ref={containerRef} className={`${className} flex items-center justify-center`} style={{ color: currentColor }}>
      <span>{displayedText}</span>
      {shouldShowCursor && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: cursorBlinkDuration, repeat: Infinity, ease: "linear" }}
          className={cursorClassName}
        >
          {cursorCharacter}
        </motion.span>
      )}
    </Component>
  );
}
