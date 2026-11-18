"use client";

import { useCallback, useState } from "react";
import { ListPicker } from "./ListPicker";
import { ShoppingList } from "./ShoppingList";

type ListRef = { id: string; name: string };

export function ShoppingApp({ userName, initialList }: { userName: string; initialList: ListRef | null }) {
  const [list, setList] = useState<ListRef | null>(initialList);
  const [picking, setPicking] = useState(initialList === null);

  const openPicker = useCallback(() => setPicking(true), []);

  if (picking || !list) {
    return (
      <ListPicker
        currentId={list?.id}
        onSelected={(l) => {
          setList(l);
          setPicking(false);
        }}
        onCancel={list ? () => setPicking(false) : undefined}
      />
    );
  }

  return <ShoppingList key={list.id} list={list} userName={userName} onSwitchList={openPicker} onNoList={openPicker} />;
}
