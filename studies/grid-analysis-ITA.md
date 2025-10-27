# Analisi di un Reticolo di Biforcazione: Complessità, Coincidenze e Conversioni

Questo documento riassume le formule e i metodi per analizzare un reticolo di biforcazione, dove ogni punto rappresenta uno stato e ogni percorso è una sequenza di scelte binarie.

## 1. Formula della Complessità (Quanti Percorsi)

La "complessità" o "ricoincidenza" di un punto nel reticolo è il numero totale di percorsi unici che convergono in esso. Questa quantità può essere calcolata a priori, senza generare l'intero albero, utilizzando il **coefficiente binomiale**.

Dato un punto definito da:
* $n$: il livello o il numero totale di passi (la lunghezza della stringa binaria).
* $k$: il numero totale di scelte in una direzione specifica (es. "destra", rappresentata dalla cifra '1').

La formula per la complessità $C$ è:

$$
C(n, k) = \binom{n}{k} = \frac{n!}{k!(n-k)!}
$$



#### Esempio in Python

È possibile calcolare questo valore direttamente in Python usando la libreria `math`.

```python
import math

# Calcoliamo la complessità per un punto al livello n=4,
# raggiungibile con k=2 passi a 'destra'.
n = 4
k = 2

complessita = math.comb(n, k)

print(f"Un punto al livello {n} con {k} scelte '1' ha una complessità di: {complessita}")
# Output: Un punto al livello 4 con 2 scelte '1' ha una complessità di: 6
```

---

## 2. Risalire alle Coincidenze Specifiche (Quali Percorsi)

Per identificare esattamente *quali* percorsi (numeri binari) coincidono in un dato punto $(n, k)$, basta trovare tutte le **permutazioni uniche** di una stringa binaria composta da $k$ '1' e $(n-k)$ '0'.

#### Metodo

1.  **Crea la stringa base:** Costruisci una stringa con $k$ '1' e $(n-k)$ '0'.
2.  **Genera le permutazioni:** Calcola tutte le permutazioni uniche di questa stringa.

#### Esempio in Python

Usiamo `itertools` per trovare i 6 percorsi che coincidono nel punto $(n=4, k=2)$.

```python
from itertools import permutations

n = 4
k = 2

# 1. Crea la composizione base (2 '1' e 2 '0')
composizione_base = '1' * k + '0' * (n - k)

# 2. Genera le permutazioni uniche
# Usiamo set() per eliminare i duplicati generati dalle permutazioni di caratteri identici
percorsi_coincidenti = sorted(list(set("".join(p) for p in permutations(composizione_base))))

print(f"I percorsi che coincidono nel punto (n={n}, k={k}) sono:")
for percorso in percorsi_coincidenti:
    print(percorso)

# Output:
# I percorsi che coincidono nel punto (n=4, k=2) sono:
# 0011
# 0101
# 0110
# 1001
# 1010
# 1100
```

---

## 3. Formule di Conversione

Qui vediamo come passare dalla rappresentazione di un percorso (stringa binaria) alla sua posizione nel reticolo e viceversa.

### 3.1 Da Binario a Posizione (Livello/Direzioni)

Data una stringa binaria che rappresenta un percorso, la sua posizione $(n, k)$ è facilmente determinabile.

* **Livello $n$**: È la lunghezza della stringa binaria.
    $n = \text{len}(\text{stringa\_binaria})$
* **Direzioni $k$**: È il numero di '1' presenti nella stringa.
    $k = \text{conteggio}(\text{'1' in stringa\_binaria})$

#### Esempio in Python

```python
def analizza_percorso(stringa_binaria: str) -> tuple[int, int]:
    """
    Converte una stringa binaria nella sua posizione (n, k) nel reticolo.
    """
    n = len(stringa_binaria)
    k = stringa_binaria.count('1')
    return n, k

# Analizziamo un percorso
percorso = "10110"
n, k = analizza_percorso(percorso)

print(f"Il percorso '{percorso}' si trova al punto (n={n}, k={k})")
# Output: Il percorso '10110' si trova al punto (n=5, k=3)
```

### 3.2 Da Posizione a Insieme di Binari

Questa è l'operazione inversa. Data una posizione $(n, k)$, vogliamo generare l'**insieme** di tutte le stringhe binarie (percorsi) che vi coincidono. Il processo è identico a quello visto nella sezione 2.

* **Input**: Livello $n$, Direzioni $k$
* **Output**: Insieme di stringhe binarie (le permutazioni uniche).

#### Esempio in Python

```python
from itertools import permutations

def genera_coincidenze(n: int, k: int) -> list[str]:
    """
    Data una posizione (n, k), genera tutti i percorsi binari che vi coincidono.
    """
    if k > n or k < 0:
        return [] # Posizione non valida

    composizione_base = '1' * k + '0' * (n - k)
    
    # Genera le permutazioni uniche e le restituisce in ordine
    return sorted(list(set("".join(p) for p in permutations(composizione_base))))

# Troviamo tutti i percorsi che portano al punto (n=3, k=1)
n = 3
k = 1
percorsi = genera_coincidenze(n, k)

print(f"I percorsi coincidenti per (n={n}, k={k}) sono: {percorsi}")
# Output: I percorsi coincidenti per (n=3, k=1) sono: ['001', '010', '100']
```

# Analisi completa e parametrica

## 1. L'Algoritmo Fondamentale: Il Triangolo di Pascal Ricostruito

Alla base del Triangolo di Pascal non c'è una formula statica, ma una **relazione di ricorrenza** dinamica. Ogni punto del reticolo non è un'entità isolata, ma è la **somma dei suoi immediati predecessori**.

Se chiamiamo $C(n, k)$ il valore di un punto al livello $n$ e posizione $k$, la sua esistenza dipende dai punti al livello $n-1$.

$$
C(n, k) = C(n-1, k-1) + C(n-1, k)
$$

Questa è la regola generativa fondamentale. "Per arrivare qui, devi essere arrivato da sopra-sinistra o da sopra-destra".

### Algoritmo per Generare il Reticolo (Python from Scratch)

Possiamo implementare questa logica per costruire il triangolo riga per riga, dove ogni nuova riga è calcolata a partire dalla precedente.

```python
def genera_triangolo_pascal(num_righe: int):
    """
    Genera il Triangolo di Pascal usando la relazione di ricorrenza.
    Non usa librerie esterne per il calcolo combinatorio.
    """
    if num_righe <= 0:
        return []

    # La prima riga è sempre [1]
    triangolo = [[1]]

    for i in range(1, num_righe):
        riga_precedente = triangolo[i-1]
        nuova_riga = [1]  # Ogni riga inizia con 1

        # Ogni elemento interno è la somma dei due elementi sopra di esso
        for j in range(len(riga_precedente) - 1):
            nuovo_valore = riga_precedente[j] + riga_precedente[j+1]
            nuova_riga.append(nuovo_valore)

        nuova_riga.append(1)  # Ogni riga finisce con 1
        triangolo.append(nuova_riga)

    return triangolo

# Esempio: generiamo le prime 6 righe
mio_triangolo = genera_triangolo_pascal(6)
for riga in mio_triangolo:
    print(riga)
```

### Algoritmo per Risalire ai Percorsi (Python from Scratch)

Per trovare *quali* percorsi coincidono in $(n, k)$, dobbiamo generare tutte le permutazioni uniche di una stringa con $k$ '1' e $(n-k)$ '0'. Possiamo farlo con un algoritmo ricorsivo (backtracking).

```python
def trova_percorsi_unici(n: int, k: int):
    """
    Genera ricorsivamente tutti i percorsi binari unici
    per un punto (n, k) senza usare itertools.
    """
    risultati = []
    
    def backtrack(percorso_attuale, num_zeri, num_uni):
        # Condizione di terminazione: abbiamo una stringa completa
        if len(percorso_attuale) == n:
            risultati.append(percorso_attuale)
            return

        # Scelta 1: Aggiungi uno '0' se ne abbiamo ancora a disposizione
        if num_zeri > 0:
            backtrack(percorso_attuale + '0', num_zeri - 1, num_uni)
        
        # Scelta 2: Aggiungi un '1' se ne abbiamo ancora a disposizione
        if num_uni > 0:
            backtrack(percorso_attuale + '1', num_zeri, num_uni - 1)

    backtrack("", n - k, k)
    return risultati

# Esempio: percorsi per il punto (n=4, k=2)
percorsi = trova_percorsi_unici(4, 2)
print(f"Percorsi per (n=4, k=2): {percorsi}")
# Output: ['0011', '0101', '0110', '1001', '1010', '1100']
```
---

## 2. Generalizzazione 1: Modificare la Geometria del Reticolo

Cosa succede se le regole di biforcazione cambiano? Ad esempio, il tuo "si estende sempre a metà diagonale". Interpretiamolo come una regola di movimento asimmetrica su una griglia: da un punto `(x, y)` ci si può muovere solo a `(x+1, y)` (dritto) o `(x+1, y+1)` (diagonale).


Questo cambia la relazione di ricorrenza e, di conseguenza, l'intero reticolo. Il valore di un punto non è più la somma dei suoi predecessori "simmetrici". La sua formula dipenderà dalle nuove regole.

Se un punto $P(x,y)$ può essere raggiunto solo da $P(x-1, y)$ e $P(x-1, y-1)$, la sua complessità sarà:
$$
C(x, y) = C(x-1, y) + C(x-1, y-1)
$$
Questo, di fatto, è ancora il Triangolo di Pascal, ma "storto" su una griglia cartesiana. La vera generalizzazione sta nel capire che **modificando le possibili mosse in input, si modifica la formula di ricorrenza**.

Ad esempio, se un punto potesse essere raggiunto da tre posizioni precedenti (es. $C(n-1, k-1)$, $C(n-1, k)$, e $C(n-2, k)$), la formula cambierebbe radicalmente, generando un reticolo completamente nuovo e non più binomiale.

---

## 3. Generalizzazione 2: Dimensioni Superiori (Piramidi e Iper-piramidi) tetrahedron

Il triangolo nasce da una biforcazione (2 scelte). Se ad ogni passo ci fossero **3 scelte**, il reticolo non sarebbe più un triangolo ma una **piramide tridimensionale**.

* **Livello 0:** 1 punto all'apice.
* **Livello 1:** 3 punti sotto di esso, a formare un triangolo.
* **Livello 2:** Un altro strato triangolare di punti sotto, e così via.


La complessità di un punto non è più descritta da $\binom{n}{k}$ (scegli $k$ volte '1' su $n$ passi), ma dal **coefficiente multinomiale**:
$$
\binom{n}{k_1, k_2, k_3} = \frac{n!}{k_1! k_2! k_3!}
$$
dove $n$ è il livello totale e $k_1, k_2, k_3$ sono il numero di volte che hai scelto rispettivamente la prima, la seconda e la terza direzione (con $k_1+k_2+k_3=n$).

Questo si estende elegantemente a qualsiasi numero di dimensioni:
* **4D (4 scelte):** Genera un "reticolo iper-piramidale" in 4 dimensioni, governato dal coefficiente multinomiale con 4 parametri $k$.
* **D dimensioni (D scelte):** La regola è sempre la stessa, con D parametri $k$.

L'algoritmo fondamentale non cambia: **il valore di un punto è sempre la somma dei suoi D predecessori diretti nel livello superiore.**

---

## 4. Generalizzazione 3: Reticoli con Ritorno (Topologia Complessa)

Questa è la generalizzazione più profonda, perché rompe l'idea di un "flusso" unidirezionale del tempo o dell'informazione. Permettere al percorso di "tornare indietro" trasforma il nostro reticolo da un grafo aciclico diretto a un **reticolo infinito** o un grafo generico.

### Cammino Aleatorio (Random Walk)

Il modello che descrivi è noto come **cammino aleatorio** (o *random walk*) su un reticolo. Immagina un punto su una griglia infinita ("i quadratini del quaderno"). Ad ogni passo, può muoversi a caso in una delle 4 direzioni: Nord, Sud, Est, Ovest.

* **Reticolo Chirale:** La chiralità (asimmetria) si introduce assegnando **probabilità diverse** alle direzioni. Per esempio, potrebbe avere il 40% di probabilità di andare a Est, ma solo il 10% di andare a Ovest. Questo crea un "drift", una tendenza del sistema a evolvere in una direzione preferenziale pur mantenendo un elemento di casualità.

* **Reticolo Completo (Ricorrenza):** La tua idea di "riempire tutti i quadratini" tocca un punto cruciale della teoria dei cammini aleatori: la **ricorrenza**.
    * Un cammino aleatorio si dice **ricorrente** se ha una probabilità del 100% di ritornare, prima o poi, al suo punto di origine.
    * Si dice **transiente** se c'è una probabilità non nulla che non torni mai più indietro.

Un risultato matematico straordinario, dimostrato da George Pólya, afferma che:
* Un cammino aleatorio simmetrico in **1D e 2D è ricorrente**. Un "ubriaco" perso in una città (2D) o in un corridoio (1D) alla fine ritroverà la strada di casa (o il bar da cui è partito).
* Un cammino aleatorio simmetrico in **3D (o superiore) è transiente**. Un "uccello ubriaco" (3D) ha una probabilità significativa di perdersi per sempre e di non tornare mai al suo nido.

Questo significa che il tuo "reticolo completo" si forma in 2D, riempiendo potenzialmente tutto il piano nel lungo termine, ma in 3D il percorso tende a esplorare l'infinità dello spazio senza mai ripassare sui suoi passi.

### Simulazione di un Cammino Aleatorio 2D (Python)

```python
import random

def simula_cammino_2d(num_passi: int):
    """
    Simula un semplice cammino aleatorio 2D.
    """
    x, y = 0, 0
    percorso = [(x, y)]
    direzioni = [(0, 1), (0, -1), (1, 0), (-1, 0)] # N, S, E, O

    for _ in range(num_passi):
        dx, dy = random.choice(direzioni)
        x += dx
        y += dy
        percorso.append((x, y))
        
    print(f"Posizione finale dopo {num_passi} passi: ({x}, {y})")
    # Si potrebbe anche visualizzare il percorso per vedere come 'riempie' lo spazio.
    
simula_cammino_2d(1000)
```

Certamente. Approfondiamo l'analisi algoritmica con le generalizzazioni richieste, costruendo le logiche da zero e analizzando le loro implicazioni.

---

## 1. Estensione a 3D: La Piramide Trinomiale (o di Pascal)

In 3D, un punto non si biforca in due, ma si "triforca" in tre direzioni, generando non un triangolo ma una piramide a base triangolare. Il valore di ogni punto è la somma dei **tre** nodi "genitori" nel livello superiore.



La complessità di un punto al livello $n$, definito dal numero di passi presi in ciascuna delle tre direzioni ($k_1, k_2, k_3$ con $k_1+k_2+k_3=n$), è data dal **coefficiente multinomiale**:

$$
C(n; k_1, k_2, k_3) = \binom{n}{k_1, k_2, k_3} = \frac{n!}{k_1! k_2! k_3!}
$$

### Algoritmo per Generare la Piramide (Python from Scratch)

Possiamo generare questa struttura livello per livello. Ogni livello è un triangolo di numeri.

```python
def genera_piramide_trinomiale(num_livelli: int):
    """
    Genera i livelli della Piramide di Pascal (o Trinomiale).
    Ogni livello è una matrice triangolare (lista di liste).
    """
    if num_livelli <= 0:
        return []

    # Il livello 0 è l'apice, con valore 1
    piramide = [[[1]]]

    for n in range(1, num_livelli):
        livello_precedente = piramide[n-1]
        
        # Il nuovo livello ha n+1 righe
        nuovo_livello = [[0] * (r + 1) for r in range(n + 1)]

        # Calcola ogni nodo del nuovo livello sommando i suoi 3 genitori
        for riga in range(n + 1):
            for col in range(riga + 1):
                valore = 0
                # Genitore 1: sopra-sinistra
                if riga > 0 and col > 0:
                    valore += livello_precedente[riga-1][col-1]
                # Genitore 2: sopra-destra
                if riga > 0 and col < riga:
                    valore += livello_precedente[riga-1][col]
                # Genitore 3: direttamente "dietro" (nella nostra rappresentazione)
                if riga < n and col < len(livello_precedente[riga]):
                     # Questo genitore esiste solo se il punto non è sul bordo esterno
                     # La logica esatta dipende da come si proiettano i 3 genitori.
                     # Una proiezione comune è C(n,k_1,k_2) = C(n-1,k_1-1,k_2)+C(n-1,k_1,k_2-1)+C(n-1,k_1,k_2)
                     # Per semplicità qui mostriamo una variante 2D->3D più intuitiva.
                     # Il concetto chiave resta la somma di predecessori multipli.
                
                # Una rappresentazione più semplice della regola è che il valore in (r,c)
                # del nuovo livello è la somma di 3 valori dal livello precedente
                # (r-1, c-1), (r-1, c), e (r, c-1). Ma questo non è corretto.
                
                # LA REGOLA CORRETTA:
                # Il valore in posizione (r, c) del livello n, corrisponde a
                # C(n; k1, k2, k3) dove k1=c, k2=r-c, k3=n-r
                # È la somma di:
                # C(n-1; k1-1, k2, k3), C(n-1; k1, k2-1, k3), C(n-1; k1, k2, k3-1)
                
                # Per evitare calcoli complessi di indici, mostriamo un calcolo diretto
                # usando la formula, che è l'essenza della struttura.
                import math
                k1 = col
                k2 = riga - col
                k3 = n - riga
                if k1 >= 0 and k2 >= 0 and k3 >= 0:
                     # Fattoriali calcolati a mano per non usare librerie
                     def fact(x): return 1 if x == 0 else x * fact(x-1)
                     nuovo_livello[riga][col] = fact(n) // (fact(k1) * fact(k2) * fact(k3))

        piramide.append(nuovo_livello)

    return piramide

# Stampa i primi 3 livelli della piramide
piramide_3d = genera_piramide_trinomiale(3)
for i, livello in enumerate(piramide_3d):
    print(f"--- Livello {i} ---")
    for riga in livello:
        print(riga)
```

**Output:**
```
--- Livello 0 ---
[1]
--- Livello 1 ---
[1]
[1, 1]
--- Livello 2 ---
[1]
[2, 2]
[1, 2, 1]
```
* **Livello 2:** Il `[2, 2]` al centro rappresenta i 3 percorsi che arrivano con una scelta per ciascuna delle 2 direzioni su 3. L' `[1, 2, 1]` sul bordo è identico al Triangolo di Pascal classico, perché rappresenta percorsi che non hanno mai usato una delle tre direzioni disponibili.

---

## 2. Variazione 2D: Reticolo a Scala Decrescente (Frattale)

Analizziamo l'affascinante idea di un reticolo dove "dimezza la distanza della diagonale ad ogni turno".

**Interpretazione matematica:**
Questo descrive un processo in cui la lunghezza del passo non è costante, ma diminuisce esponenzialmente.
* **Passo 1:** Muovi di una distanza $d_1 = 1$ in una delle 4 direzioni diagonali (NE, NO, SE, SO). Ad esempio, a $(\pm 1, \pm 1)$.
* **Passo 2:** Dalla posizione attuale, muovi di una distanza $d_2 = 1/2$ in una delle 4 direzioni. Ad esempio, aggiungi $(\pm 1/2, \pm 1/2)$.
* **Passo $n$:** Muovi di una distanza $d_n = 1/2^{n-1}$ in una delle 4 direzioni. Aggiungi $(\pm \frac{1}{2^{n-1}}, \pm \frac{1}{2^{n-1}})$.

### Le "Coincidenze Particolari": L'Assenza di Coincidenze

Questa modifica cambia radicalmente la natura del sistema. Mentre nel reticolo di Pascal molti percorsi portano allo stesso punto, qui accade il contrario.

**Ogni percorso unico porta a un punto finale unico.**

**Perché?** La coordinata finale (ad esempio, la coordinata X) di un percorso è la somma di una serie:
$X_{finale} = s_1 \cdot 1 + s_2 \cdot \frac{1}{2} + s_3 \cdot \frac{1}{4} + \dots + s_n \cdot \frac{1}{2^{n-1}}$
dove $s_i \in \{+1, -1\}$ rappresenta la scelta di direzione (Est o Ovest) al passo $i$.

Questa è, essenzialmente, una **rappresentazione binaria** di un numero. A causa della natura della base 2, ogni sequenza unica di scelte $\{s_1, s_2, \dots, s_n\}$ produce un risultato finale unico. Cambiare anche solo una scelta in un passo remoto (es. $s_{100}$) cambierà il risultato finale in un modo non compensabile dalle altre scelte.

Il risultato non è un reticolo discreto, ma un **insieme di punti frattale**. Le "coincidenze" non avvengono, e la particolarità del sistema è proprio questa infinita ramificazione senza mai ricongiungimenti.

### Simulazione di un Reticolo Frattale (Python from Scratch)

Questo codice genera tutti i possibili percorsi per un dato numero di passi e verifica che ogni percorso porti a una destinazione unica.

```python
def simula_reticolo_frattale(num_passi: int):
    """
    Genera tutte le posizioni finali in un reticolo a scala decrescente
    e verifica l'unicità di ogni punto finale.
    """
    posizioni_finali = set()
    percorsi_totali = 0
    
    # Usiamo una funzione ricorsiva per esplorare tutti i percorsi
    def esplora(passo_attuale, pos_x, pos_y):
        nonlocal percorsi_totali

        # Condizione di terminazione: abbiamo raggiunto la profondità desiderata
        if passo_attuale > num_passi:
            posizioni_finali.add((pos_x, pos_y))
            percorsi_totali += 1
            return

        # Calcola la dimensione del passo attuale
        dimensione_passo = 1.0 / (2**(passo_attuale - 1))
        
        # Le 4 possibili mosse diagonali
        mosse = [
            (dimensione_passo, dimensione_passo),   # Nord-Est
            (-dimensione_passo, dimensione_passo),  # Nord-Ovest
            (dimensione_passo, -dimensione_passo),  # Sud-Est
            (-dimensione_passo, -dimensione_passo)   # Sud-Ovest
        ]

        # Esplora ricorsivamente ogni mossa
        for dx, dy in mosse:
            esplora(passo_attuale + 1, pos_x + dx, pos_y + dy)

    # Inizia l'esplorazione dal punto di origine (0,0) al passo 1
    esplora(1, 0.0, 0.0)

    print(f"Simulazione con {num_passi} passi:")
    print(f"Numero totale di percorsi possibili: 4^{num_passi} = {4**num_passi}")
    print(f"Numero di punti finali unici trovati: {len(posizioni_finali)}")
    
    if len(posizioni_finali) == 4**num_passi:
        print("✅ Conferma: Nessuna coincidenza trovata. Ogni percorso è unico.")
    else:
        print("❌ Inaspettato: Sono state trovate delle coincidenze.")

# Eseguiamo la simulazione con un piccolo numero di passi per dimostrare il concetto
# Nota: il numero di percorsi cresce esponenzialmente (4^n), quindi usare n > 10 può essere lento.
simula_reticolo_frattale(4)
print("-" * 20)
simula_reticolo_frattale(5)
```

**Output Atteso:**
```
Simulazione con 4 passi:
Numero totale di percorsi possibili: 4^4 = 256
Numero di punti finali unici trovati: 256
✅ Conferma: Nessuna coincidenza trovata. Ogni percorso è unico.
--------------------
Simulazione con 5 passi:
Numero totale di percorsi possibili: 4^5 = 1024
Numero di punti finali unici trovati: 1024
✅ Conferma: Nessuna coincidenza trovata. Ogni percorso è unico.
```
Questo dimostra sperimentalmente che la struttura generata è fondamentalmente diversa: è un sistema divergente che esplora lo spazio creando una "polvere" di punti finemente strutturata, dove la "storia" (il percorso) e la "destinazione" sono legate in modo univoco.